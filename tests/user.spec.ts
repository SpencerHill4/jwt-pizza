import { Page } from "@playwright/test";
import { Role, User } from "../src/service/pizzaService";
import { test, expect } from "./testSetup";
import { mockAuthentication, mockOrders, openLogin } from "./testHelper";

async function updateProfileForRole(page: Page, role: Role) {
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  const newEmail = `updated${Math.floor(Math.random() * 10000)}@jwt.com`;
  const password = "diner";
  const newPassword = "newPassword";
  const profileRole =
    role === Role.Franchisee ? { role, objectId: "2" } : { role };
  const displayedRole = role === Role.Franchisee ? "Franchisee on 2" : role;
  const user: User = {
    id: "4",
    name: "pizza diner",
    email,
    password,
    roles: [profileRole],
  };

  await mockAuthentication(page, [user]);
  await mockOrders(page);
  await page.goto("/");
  await openLogin(page, email, password);
  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza diner");

  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("h3")).toContainText("Edit user");
  const editFields = page.getByRole("dialog").getByRole("textbox");
  await editFields.nth(0).fill("pizza dinerx");
  await editFields.nth(1).fill(newEmail);
  await editFields.nth(2).fill(newPassword);
  await page.getByRole("button", { name: "Update" }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: "attached" });
  await expect(page.getByRole("main")).toContainText("pizza dinerx");

  await page.getByRole("link", { name: "Logout" }).click();
  await openLogin(page, newEmail, newPassword);
  await page.getByRole("link", { name: "pd" }).click();

  await expect(page.getByRole("main")).toContainText("pizza dinerx");
  await expect(page.getByRole("main")).toContainText(newEmail);
  await expect(page.getByRole("main")).toContainText(displayedRole);
}

test("diner can update their profile", async ({ page }) => {
  await updateProfileForRole(page, Role.Diner);
});

test("franchisee can update their profile", async ({ page }) => {
  await updateProfileForRole(page, Role.Franchisee);
});

test("admin can update their profile", async ({ page }) => {
  await updateProfileForRole(page, Role.Admin);
});

test("profile update failures are shown in the edit modal", async ({ page }) => {
  const user: User = {
    id: "4",
    name: "pizza diner",
    email: "diner@jwt.com",
    password: "diner",
    roles: [{ role: Role.Diner }],
  };

  await mockAuthentication(page, [user]);
  await page.route("*/**/api/user/4", async (route) => {
    expect(route.request().method()).toBe("PUT");
    await route.fulfill({
      status: 500,
      json: { message: "Profile update failed" },
    });
  });
  await mockOrders(page);
  await page.goto("/");
  await openLogin(page, user.email!, user.password!);
  await page.getByRole("link", { name: "pd" }).click();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Update" }).click();

  await expect(page.getByRole("alert")).toContainText("Profile update failed");
  await expect(page.getByRole("dialog")).toBeVisible();
});
