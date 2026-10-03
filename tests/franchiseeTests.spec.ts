import { Page } from "@playwright/test";
import { test, expect } from "./testSetup";
import { Franchise, Role } from "../src/service/pizzaService";
import {
  mockAuthentication,
  mockMenu,
  mockOrders,
  openLogin,
} from "./testHelper";

async function basicInit(page: Page) {
  const franchise: Franchise = {
    id: "2",
    name: "LotaPizza",
    stores: [
      { id: "4", name: "Lehi", totalRevenue: 150 },
      { id: "5", name: "Springville", totalRevenue: 200 },
    ],
  };
  await mockAuthentication(page, [
    {
      id: "3",
      name: "Kai Chen",
      email: "f@jwt.com",
      password: "a",
      roles: [{ role: Role.Franchisee, objectId: "2" }],
    },
  ]);

  await mockMenu(page);

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

  await mockOrders(page);

  await page.goto("/");
}

async function openFranchiseDashboard(page: Page) {
  await openLogin(page, "f@jwt.com", "a");
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Franchise" })
    .click();
}

test("franchisee role appears on diner dashboard", async ({ page }) => {
  await basicInit(page);

  await openLogin(page, "f@jwt.com", "a");
  await page.getByRole("link", { name: "KC" }).click();

  await expect(page.getByRole("heading")).toContainText("Your pizza kitchen");
  await expect(page.getByRole("main")).toContainText(
    "name: Kai Chenemail: f@jwt.comrole: Franchisee on 2",
  );
});

test("franchise dashboard with a franchisee", async ({ page }) => {
  await basicInit(page);

  await openFranchiseDashboard(page);

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

  await openFranchiseDashboard(page);

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await page.getByRole("button", { name: "Create store" }).click();
  await page.getByRole("textbox", { name: "store name" }).fill("Spanish Fork");
  await page.getByRole("button", { name: "Create" }).click();

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await expect(page.locator("tbody")).toContainText("Spanish Fork");
});

test("franchisee can close store", async ({ page }) => {
  await basicInit(page);

  await openFranchiseDashboard(page);

  await expect(page.getByRole("heading", { name: "LotaPizza" })).toBeVisible();
  await page
    .getByRole("row", { name: "Lehi 150 ₿ Close" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("tbody")).not.toContainText("Lehi");
});
