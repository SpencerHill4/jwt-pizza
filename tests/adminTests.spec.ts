import { Page } from "@playwright/test";
import { test, expect } from "./testSetup";
import { Franchise, User, Role } from "../src/service/pizzaService";

async function basicInit(page: Page, role: Role = Role.Admin) {
  let loggedInUser: User | undefined;
  const franchise: Franchise = {
    id: "2",
    name: "LotaPizza",
    admins: [{ email: "f@jwt.com", name: "Kai Chen" }],
    stores: [
      { id: "4", name: "Lehi", totalRevenue: 150 },
      { id: "5", name: "Springville", totalRevenue: 200 },
    ],
  };
  const franchises: Franchise[] = [
    franchise,
    {
      id: "3",
      name: "PizzaCorp",
      stores: [{ id: "7", name: "Spanish Fork" }],
    },
    { id: "4", name: "topSpot", stores: [] },
    {
      id: "5",
      name: "Slice City",
      stores: [{ id: "8", name: "Provo", totalRevenue: 75 }],
    },
  ];
  let nextFranchiseId = 5;
  const validUsers: Record<string, User> = {
    "f@jwt.com": {
      id: "3",
      name: "Kai Chen",
      email: "f@jwt.com",
      password: "a",
      roles: [{ role }],
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
    const storeIndex = franchise.stores.findIndex(
      (store) => store.id === storeId,
    );
    expect(storeIndex).not.toBe(-1);
    franchise.stores.splice(storeIndex, 1);
    await route.fulfill({ json: null });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    if (route.request().method() === "POST") {
      const franchiseReq = route.request().postDataJSON() as Franchise;
      const createdFranchise: Franchise = {
        ...franchiseReq,
        id: String(nextFranchiseId++),
        stores: [],
      };
      franchises.unshift(createdFranchise);
      await route.fulfill({ json: createdFranchise });
      return;
    }

    expect(route.request().method()).toBe("GET");
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 10);
    const nameFilter = (url.searchParams.get("name") ?? "*")
      .replace(/\*/g, "")
      .toLowerCase();
    const matchingFranchises = franchises.filter((item) =>
      item.name.toLowerCase().includes(nameFilter),
    );
    const start = pageNumber * limit;
    const pagedFranchises = matchingFranchises.slice(start, start + limit);
    await route.fulfill({
      json: {
        franchises: pagedFranchises,
        more: start + pagedFranchises.length < matchingFranchises.length,
      },
    });
  });

  await page.route(/\/api\/franchise\/[^/]+$/, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    const franchiseId = new URL(route.request().url()).pathname.split("/").pop();
    const franchiseIndex = franchises.findIndex((item) => item.id === franchiseId);
    expect(franchiseIndex).not.toBe(-1);
    franchises.splice(franchiseIndex, 1);
    await route.fulfill({ json: null });
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

test("admin dashboard", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();
  await expect(page.locator("h2")).toContainText("Mama Ricci's kitchen");
  await expect(page.getByRole("table")).toContainText("LotaPizza");
  await expect(page.getByRole("table")).toContainText("PizzaCorp");
  await expect(page.getByRole("table")).toContainText("topSpot");
  await expect(page.getByRole("table")).toContainText("Kai Chen");
  await expect(page.getByRole("table")).toContainText("150 ₿");
  await expect(
    page.getByRole("textbox", { name: "Filter franchises" }),
  ).toBeVisible();
});

test("admin can filter franchises", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();

  await page
    .getByRole("textbox", { name: "Filter franchises" })
    .fill("PizzaCorp");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("table")).toContainText("PizzaCorp");
  await expect(page.getByRole("table")).not.toContainText("LotaPizza");
});

test("admin can paginate franchises", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();

  const nextPage = page.getByRole("button", { name: "»" });
  const previousPage = page.getByRole("button", { name: "«" });
  await expect(previousPage).toBeDisabled();
  await expect(nextPage).toBeEnabled();

  await nextPage.click();
  await expect(page.getByRole("table")).toContainText("Slice City");
  await expect(page.getByRole("table")).not.toContainText("LotaPizza");
  await expect(previousPage).toBeEnabled();
  await expect(nextPage).toBeDisabled();

  await previousPage.click();
  await expect(page.getByRole("table")).toContainText("LotaPizza");
  await expect(page.getByRole("table")).not.toContainText("Slice City");
});

test("admin can create franchise", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();
  await page.getByRole("button", { name: "Add Franchise" }).click();
  await page
    .getByRole("textbox", { name: "franchise name" })
    .fill("Billy's Pie");
  await page
    .getByRole("textbox", { name: "franchisee admin email" })
    .fill("d@jwt.com");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("table")).toContainText("Billy's Pie");
});

test("admin can close franchise", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();
  await page
    .getByRole("row", { name: "PizzaCorp Close" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("table")).not.toContainText("PizzaCorp");
});

test("admin can close a store", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();

  await page
    .getByRole("row", { name: "Lehi 150 ₿ Close" })
    .getByRole("button", { name: "Close" })
    .click();
  await expect(page.getByRole("main")).toContainText(
    "Are you sure you want to close the LotaPizza store Lehi",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByRole("heading", { name: "Mama Ricci's kitchen" }),
  ).toBeVisible();
});

test("non-admin cannot use the admin dashboard", async ({ page }) => {
  await basicInit(page, Role.Diner);

  await page.getByRole("link", { name: "Login" }).click();
  await page.getByRole("textbox", { name: "Email address" }).fill("f@jwt.com");
  await page.getByRole("textbox", { name: "Password" }).fill("a");
  await page.getByRole("button", { name: "Login" }).click();
  await page.goto("/admin-dashboard");

  await expect(page.getByRole("heading", { name: "Oops" })).toBeVisible();
});
