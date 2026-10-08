import { Page } from "@playwright/test";
import { expect } from "./testSetup";
import { Order, Role, User } from "../src/service/pizzaService";

export async function mockAuthentication(page: Page, users: User[]) {
  const validUsers = new Map<string, User>();
  users.forEach((user) => {
    if (user.email) {
      validUsers.set(user.email, user);
    }
  });
  let loggedInUser: User | undefined;

  await page.route("*/**/api/auth", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ json: {} });
      return;
    }

    if (route.request().method() === "POST") {
      const registrationReq = route.request().postDataJSON() as {
        name: string;
        email: string;
        password: string;
      };
      const user: User = {
        id: "4",
        name: registrationReq.name,
        email: registrationReq.email,
        password: registrationReq.password,
        roles: [{ role: Role.Diner }],
      };
      validUsers.set(registrationReq.email, user);
      loggedInUser = user;
      await route.fulfill({ json: { user, token: "abcdef" } });
      return;
    }

    const loginReq = route.request().postDataJSON() as {
      email: string;
      password: string;
    };
    const user = validUsers.get(loginReq.email);
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      return;
    }
    loggedInUser = user;
    expect(route.request().method()).toBe("PUT");
    await route.fulfill({ json: { user: loggedInUser, token: "abcdef" } });
  });

  await page.route("*/**/api/user/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  await page.route(/\/api\/user\/(?!me$)[^/]+$/, async (route) => {
    expect(route.request().method()).toBe("PUT");
    const updatedUser = route.request().postDataJSON() as User;
    const existingUser = Array.from(validUsers.values()).find(
      (user) => user.id === updatedUser.id,
    );

    expect(existingUser).toBeDefined();
    if (!existingUser) {
      throw new Error(`No user found with id ${updatedUser.id}`);
    }
    expect(updatedUser.email).toBeTruthy();
    if (!updatedUser.email) {
      throw new Error("Updated user must have an email");
    }

    if (existingUser.email) {
      validUsers.delete(existingUser.email);
    }
    validUsers.set(updatedUser.email, updatedUser);
    loggedInUser = updatedUser;
    await route.fulfill({ json: { user: updatedUser, token: "abcdef" } });
  });
}

export async function login(page: Page, email: string, password: string) {
  await page.getByRole("textbox", { name: "Email address" }).fill(email);
  await page.getByRole("textbox", { name: "Password" }).fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

export async function openLogin(page: Page, email: string, password: string) {
  await page.getByRole("link", { name: "Login" }).click();
  await login(page, email, password);
}

export async function mockMenu(page: Page) {
  await page.route("*/**/api/order/menu", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      json: [
        {
          id: 1,
          title: "Veggie",
          image: "pizza1.png",
          price: 0.0038,
          description: "A garden of delight",
        },
        {
          id: 2,
          title: "Pepperoni",
          image: "pizza2.png",
          price: 0.0042,
          description: "Spicy treat",
        },
      ],
    });
  });
}

export async function mockOrders(page: Page, orders: Order[] = []) {
  await page.route("*/**/api/order", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { id: "3", dinerId: "3", orders },
      });
      return;
    }

    expect(route.request().method()).toBe("POST");
    const order = route.request().postDataJSON() as Order;
    await route.fulfill({
      json: { order: { ...order, id: 23 }, jwt: "eyJpYXQ" },
    });
  });
}