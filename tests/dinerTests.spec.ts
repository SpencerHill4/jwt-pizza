import { Page } from "@playwright/test";
import { test, expect } from "./testSetup";
import { Order, Role } from "../src/service/pizzaService";
import {
  login,
  mockAuthentication,
  mockMenu,
  mockOrders,
  openLogin,
} from "./testHelper";

async function basicInit(
  page: Page,
  orders: Order[] = [],
  verificationFails = false,
) {
  await mockAuthentication(page, [
    {
      id: "3",
      name: "Kai Chen",
      email: "d@jwt.com",
      password: "a",
      roles: [{ role: Role.Diner }],
    },
  ]);

  await mockMenu(page);

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

  await mockOrders(page, orders);

  await page.route("**/api/order/verify", async (route) => {
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ jwt: "eyJpYXQ" });
    if (verificationFails) {
      await route.fulfill({
        status: 400,
        json: { message: "Invalid JWT" },
      });
      return;
    }
    await route.fulfill({
      json: { message: "valid", payload: "Order verified" },
    });
  });

  await page.goto("/");
}

async function orderPizza(page: Page) {
  await page.getByRole("button", { name: "Order now" }).click();
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("button", { name: "Checkout" }).click();
  await login(page, "d@jwt.com", "a");
  await page.getByRole("button", { name: "Pay now" }).click();
  await expect(page.getByRole("heading")).toContainText("Here is your JWT Pizza!");
}

async function openDinerDashboard(page: Page) {
  await openLogin(page, "d@jwt.com", "a");
  await page.getByRole("link", { name: "KC" }).click();
}

async function registerDiner(page: Page, name: string, email: string) {
  await page.getByRole("link", { name: "Register" }).click();
  await page.getByPlaceholder("Full name").fill(name);
  await page.getByPlaceholder("Email address").fill(email);
  await page.getByPlaceholder("Password").fill("a");
  await page.getByRole("button", { name: "Register" }).click();
}

const docsResponse = {
  endpoints: [
    {
      requiresAuth: true,
      method: "POST",
      path: "/api/order",
      description: "Place a pizza order",
      example: '{ "items": [] }',
      response: { id: "23" },
    },
    {
      requiresAuth: false,
      method: "GET",
      path: "/api/order/menu",
      description: "Get the pizza menu",
      example: "",
      response: [{ id: "1", title: "Veggie" }],
    },
  ],
};

async function expectDocs(page: Page, path: string, apiHost: string) {
  let docsUrl = "";
  await page.route("**/api/docs", async (route) => {
    expect(route.request().method()).toBe("GET");
    docsUrl = route.request().url();
    await route.fulfill({ json: docsResponse });
  });

  await page.goto(path);
  await expect(page.getByRole("heading", { name: "JWT Pizza API" })).toBeVisible();
  await expect(
    page.getByRole("heading").filter({ hasText: "[POST] /api/order" }),
  ).toContainText("🔐");
  await expect(page.getByText("Place a pizza order")).toBeVisible();
  await expect(page.getByText('{ "items": [] }')).toBeVisible();
  await expect(page.locator("pre").first()).toContainText('"id": "23"');
  await expect(
    page.getByRole("heading").filter({ hasText: "[GET] /api/order/menu" }),
  ).toBeVisible();
  await expect(page.getByText("Get the pizza menu")).toBeVisible();
  await expect(page.locator('a[href*="localhost:3000"]')).toBeVisible();
  await expect(page.locator('a[href*="pizza-factory"]')).toBeVisible();
  expect(new URL(docsUrl).hostname).toContain(apiHost);
}

test("service API docs are displayed", async ({ page }) => {
  await basicInit(page);
  await expectDocs(page, "/docs", "localhost");
});

test("factory API docs are displayed", async ({ page }) => {
  await basicInit(page);
  await expectDocs(page, "/docs/factory", "pizza-factory");
});

test("login", async ({ page }) => {
  await basicInit(page);
  await openLogin(page, "d@jwt.com", "a");

  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();
});

test("register", async ({ page }) => {
  await basicInit(page);

  await registerDiner(page, "Ada Lovelace", "ada@jwt.com");

  await expect(page.getByRole("link", { name: "AL" })).toBeVisible();
});

test("purchase with login", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("button", { name: "Order now" }).click();

  await expect(page.locator("h2")).toContainText("Awesome is a click away");
  await page.getByRole("combobox").selectOption("4");
  await page.getByRole("link", { name: "Image Description Veggie A" }).click();
  await page.getByRole("link", { name: "Image Description Pepperoni" }).click();
  await expect(page.locator("form")).toContainText("Selected pizzas: 2");
  await page.getByRole("button", { name: "Checkout" }).click();

  await login(page, "d@jwt.com", "a");

  await expect(page.getByRole("main")).toContainText(
    "Send me those 2 pizzas right now!",
  );
  await expect(page.locator("tbody")).toContainText("Veggie");
  await expect(page.locator("tbody")).toContainText("Pepperoni");
  await expect(page.locator("tfoot")).toContainText("0.008 ₿");
  await page.getByRole("button", { name: "Pay now" }).click();

  await expect(page.getByText("0.008")).toBeVisible();
});

test("delivery verifies a valid JWT", async ({ page }) => {
  await basicInit(page);
  await orderPizza(page);

  await expect(page.getByText("order ID:").locator("..")).toContainText("23");
  await expect(page.getByText("total:").locator("..")).toContainText("0.004 ₿");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator("#hs-jwt-modal h3")).toContainText("valid");
  await expect(page.locator("#hs-jwt-modal pre")).toContainText(
    "Order verified",
  );
});

test("delivery lets the diner order more", async ({ page }) => {
  await basicInit(page);
  await orderPizza(page);

  await page.getByRole("button", { name: "Order more" }).click();
  await expect(page.locator("h2")).toContainText("Awesome is a click away");
});

test("delivery handles missing order state", async ({ page }) => {
  await basicInit(page);
  await page.goto("/delivery");

  await expect(page.getByRole("heading")).toContainText("Here is your JWT Pizza!");
  await expect(page.getByText("error", { exact: true })).toBeVisible();
});

test("delivery displays an error for an invalid JWT", async ({ page }) => {
  await basicInit(page, [], true);
  await orderPizza(page);

  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page.locator("#hs-jwt-modal h3")).toContainText("Invalid JWT");
  await expect(page.locator("#hs-jwt-modal pre")).toContainText(
    "bad pizza",
  );
});

test("about page", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "About" }).click();
  await expect(page.getByRole("main")).toContainText("The secret sauce");
  await expect(
    page.getByRole("img", { name: "Employee stock photo" }).first(),
  ).toBeVisible();
});

test("history page", async ({ page }) => {
  await basicInit(page);

  await page.getByRole("link", { name: "History" }).click();
  await expect(page.getByRole("heading")).toContainText("Mama Rucci, my my");
  await expect(page.getByRole("main").getByRole("img")).toBeVisible();
});

test("diner dashboard", async ({ page }) => {
  await basicInit(page);

  await openDinerDashboard(page);
  await expect(page.getByRole("heading")).toContainText("Your pizza kitchen");
  await expect(
    page.getByRole("img", { name: "Employee stock photo" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toContainText(
    "name: Kai Chenemail: d@jwt.comrole: diner",
  );
});

test("diner dashboard shows order history", async ({ page }) => {
  await basicInit(page, [
    {
      id: "23",
      franchiseId: "2",
      storeId: "4",
      date: "2026-10-02T12:00:00.000Z",
      items: [
        {
          menuId: "1",
          description: "Veggie",
          price: 0.0038,
        },
      ],
    },
  ]);

  await openDinerDashboard(page);

  await expect(page.getByRole("heading")).toContainText("Your pizza kitchen");
  await expect(page.getByRole("main")).toContainText(
    "name: Kai Chenemail: d@jwt.comrole: diner",
  );
  await expect(page.locator("tbody")).toContainText("23");
  await expect(page.locator("tbody")).toContainText("0.004 ₿");
});

test("franchise dashboard as non-franchisee", async ({ page }) => {
  await basicInit(page);

  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();
  await expect(page.getByRole("main")).toContainText(
    "So you want a piece of the pie?",
  );
  await expect(page.locator("thead")).toContainText("Profit");
  await expect(page.locator("tbody")).toContainText("150 ₿");
  await expect(page.getByRole("main")).toContainText("Unleash Your Potential");

  await expect(page.getByRole("link", { name: "-555-5555" })).toBeVisible();
});

test("register new user", async ({ page }) => {
  await basicInit(page);

  await registerDiner(page, "New User", "new@jwt.com");

  await expect(page.getByRole("link", { name: "NU" })).toBeVisible();
});

test("logout", async ({ page }) => {
  await basicInit(page);

  await openLogin(page, "d@jwt.com", "a");
  await expect(page.getByRole("link", { name: "KC" })).toBeVisible();

  await page.getByRole("link", { name: "Logout" }).click();
  await expect(page.getByRole("link", { name: "Login" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Register" })).toBeVisible();
});
