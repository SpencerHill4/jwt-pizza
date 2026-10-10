import { Page } from "@playwright/test";
import { test, expect } from "./testSetup";
import { Franchise, Role, User } from "../src/service/pizzaService";
import {
  mockAuthentication,
  mockMenu,
  mockOrders,
  openLogin,
} from "./testHelper";

async function basicInit(page: Page, role: Role = Role.Admin) {
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
  const users: User[] = [
    {
      id: "10",
      name: "Ada User",
      email: "ada@jwt.com",
      roles: [{ role: Role.Diner }],
    },
    {
      id: "11",
      name: "Bill User",
      email: "bill@jwt.com",
      roles: [{ role: Role.Franchisee, objectId: "2" }],
    },
    {
      id: "12",
      name: "Cora User",
      email: "cora@jwt.com",
      roles: [{ role: Role.Admin }],
    },
    {
      id: "13",
      name: "Dino User",
      email: "dino@jwt.com",
      roles: [{ role: Role.Diner }],
    },
  ];
  let nextFranchiseId = 5;
  await mockAuthentication(page, [
    {
      id: "3",
      name: "Kai Chen",
      email: "f@jwt.com",
      password: "a",
      roles: [{ role }],
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
    const franchiseId = new URL(route.request().url()).pathname
      .split("/")
      .pop();
    const franchiseIndex = franchises.findIndex(
      (item) => item.id === franchiseId,
    );
    expect(franchiseIndex).not.toBe(-1);
    franchises.splice(franchiseIndex, 1);
    await route.fulfill({ json: null });
  });

  await page.route(/\/api\/user(?:\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe("GET");
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 10);
    const nameFilter = (url.searchParams.get("name") ?? "*")
      .replace(/\*/g, "")
      .toLowerCase();
    const matchingUsers = users.filter((user) =>
      user.name?.toLowerCase().includes(nameFilter),
    );
    const start = (pageNumber - 1) * limit;
    const pagedUsers = matchingUsers.slice(start, start + limit);
    await route.fulfill({
      json: {
        users: pagedUsers,
        more: start + pagedUsers.length < matchingUsers.length,
      },
    });
  });

  await page.route(/\/api\/user\/(?!me$)[^/]+$/, async (route) => {
    expect(route.request().method()).toBe("DELETE");
    const userId = new URL(route.request().url()).pathname.split("/").pop();
    const userIndex = users.findIndex((user) => user.id === userId);
    expect(userIndex).not.toBe(-1);
    users.splice(userIndex, 1);
    await route.fulfill({ json: { deleted: true } });
  });

  await mockOrders(page);

  await page.goto("/");
}

async function openAdminDashboard(page: Page) {
  await openLogin(page, "f@jwt.com", "a");
  await page
    .getByRole("navigation", { name: "Global" })
    .getByRole("link", { name: "Admin" })
    .click();
}

test("admin dashboard", async ({ page }) => {
  await basicInit(page);

  await openAdminDashboard(page);
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

test("admin dashboard tabs switch between franchises and users", async ({
  page,
}) => {
  await basicInit(page);
  await openAdminDashboard(page);

  await page.getByRole("tab", { name: "Users" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Ada User");

  await page.getByRole("tab", { name: "Franchises" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("LotaPizza");
});

test("admin can filter and paginate users", async ({ page }) => {
  await basicInit(page);
  await openAdminDashboard(page);
  await page.getByRole("tab", { name: "Users" }).click();

  await expect(page.getByRole("table")).toContainText("Ada User");
  await expect(page.getByRole("table")).not.toContainText("Dino User");
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("table")).toContainText("Dino User");

  await page.getByRole("textbox", { name: "Filter users" }).fill("Cora");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("table")).toContainText("Cora User");
  await expect(page.getByRole("table")).not.toContainText("Ada User");
  await expect(
    page.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();
});

test("admin can delete a user", async ({ page }) => {
  await basicInit(page);
  await openAdminDashboard(page);
  await page.getByRole("tab", { name: "Users" }).click();

  await page
    .getByRole("row", { name: "Ada User ada@jwt.com diner Delete" })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Delete user" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Are you sure you want to delete Ada User/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page.getByRole("tab", { name: "Users" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("table")).not.toContainText("Ada User");
});

test("admin can filter franchises", async ({ page }) => {
  await basicInit(page);

  await openAdminDashboard(page);

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByRole("table")).toContainText("Slice City");

  await page
    .getByRole("textbox", { name: "Filter franchises" })
    .fill("PizzaCorp");
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("table")).toContainText("PizzaCorp");
  await expect(page.getByRole("table")).not.toContainText("LotaPizza");
  await expect(
    page.getByRole("button", { name: "Previous page" }),
  ).toBeDisabled();
});

test("admin can paginate franchises", async ({ page }) => {
  await basicInit(page);

  await openAdminDashboard(page);

  const nextPage = page.getByRole("button", { name: "Next page" });
  const previousPage = page.getByRole("button", { name: "Previous page" });
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

  await openAdminDashboard(page);
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

  await openAdminDashboard(page);
  await page
    .getByRole("row", { name: "PizzaCorp Close" })
    .getByRole("button")
    .click();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("table")).not.toContainText("PizzaCorp");
});

test("admin can close a store", async ({ page }) => {
  await basicInit(page);

  await openAdminDashboard(page);

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

  await openLogin(page, "f@jwt.com", "a");
  await page.goto("/admin-dashboard");

  await expect(page.getByRole("heading", { name: "Oops" })).toBeVisible();
});
