import { Page } from "@playwright/test";
import { test, expect } from "./testSetup";
import { Franchise, User, Role } from "../src/service/pizzaService";

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const franchise: Franchise = {
    id: "2",
    name: "LotaPizza",
    stores: [
      { id: "4", name: "Lehi", totalRevenue: 150 },
      { id: "5", name: "Springville", totalRevenue: 200 },
    ],
  };
  const validUsers: Record<string, User> = {
    "f@jwt.com": {
      id: "3",
      name: "Kai Chen",
      email: "f@jwt.com",
      password: "a",
      roles: [{ role: Role.Franchisee }],
    },
  };

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
      validUsers[registrationReq.email] = user;
      loggedInUser = user;
      await route.fulfill({ json: { user, token: "abcdef" } });
      return;
    }

    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
      return;
    }
    loggedInUser = validUsers[loginReq.email];
    const loginRes = {
      user: loggedInUser,
      token: "abcdef",
    };
    expect(route.request().method()).toBe("PUT");
    await route.fulfill({ json: loginRes });
  });

  await page.route("*/**/api/user/me", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: loggedInUser });
  });

  await page.route("*/**/api/order/menu", async (route) => {
    const menuRes = [
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
    ];
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: menuRes });
  });

  await page.route("*/**/api/franchise/3", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: [franchise] });
  });

  await page.route("*/**/api/franchise/2/store", async (route) => {
    expect(route.request().method()).toBe("POST");
    const storeReq = route.request().postDataJSON() as { name: string };
    const storeRes = { id: "6", name: storeReq.name };
    franchise.stores.push(storeRes);
    await route.fulfill({ json: storeRes });
  });

  await page.route(/\/api\/franchise\/2\/store\/[^/]+$/, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    const storeId = new URL(route.request().url()).pathname.split("/").pop();
    const storeIndex = franchise.stores.findIndex((store) => store.id === storeId);
    expect(storeIndex).not.toBe(-1);
    franchise.stores.splice(storeIndex, 1);
    await route.fulfill({ json: null });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    const franchiseRes = {
      franchises: [
        {
          id: 2,
          name: "LotaPizza",
          stores: [
            { id: 4, name: "Lehi" },
            { id: 5, name: "Springville" },
            { id: 6, name: "American Fork" },
          ],
        },
        { id: 3, name: "PizzaCorp", stores: [{ id: 7, name: "Spanish Fork" }] },
        { id: 4, name: "topSpot", stores: [] },
      ],
    };
    expect(route.request().method()).toBe("GET");
    await route.fulfill({ json: franchiseRes });
  });

  await page.route("*/**/api/order", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { id: "3", dinerId: "3", orders: [] },
      });
      return;
    }

    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: "eyJpYXQ",
    };
    expect(route.request().method()).toBe("POST");
    await route.fulfill({ json: orderRes });
  });

  await page.goto("/");
}

test("franchise dashboard with a franchisee", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await expect(page.locator("tbody")).toContainText("Lehi");
  await expect(page.locator("tbody")).toContainText("Springville");
  await expect(
    page.getByRole("row", { name: "Lehi 150 ₿ Close" }).getByRole("button"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create store" }),
  ).toBeVisible();
});

test("franchisee can create store", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await page.getByRole("button", { name: "Create store" }).click();
  await page.getByRole("textbox", { name: "store name" }).fill("Spanish Fork");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await expect(page.locator("tbody")).toContainText("Spanish Fork");
});

test("franchisee can close store", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await page
    .getByRole("row", { name: "Lehi 150 ₿ Close" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("tbody")).not.toContainText("Lehi");
});
