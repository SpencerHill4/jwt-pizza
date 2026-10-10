import React from "react";
import { useLocation } from "react-router-dom";
import Button from "../components/button";
import { useBreadcrumb } from "../hooks/appNavigation";
import { pizzaService } from "../service/service";
import { User } from "../service/pizzaService";
import View from "./view";

interface DeleteUserState {
  user?: User;
  activeTab?: "franchises" | "users";
}

export default function DeleteUser() {
  const state = useLocation().state as DeleteUserState | null;
  const navigateToParent = useBreadcrumb();
  const [error, setError] = React.useState("");

  async function deleteUser() {
    if (!state?.user?.id) {
      setError("Unable to delete this user because their ID is missing.");
      return;
    }

    try {
      const result = await pizzaService.deleteUser(state.user.id);
      if (!result.deleted) {
        setError("The user could not be deleted.");
        return;
      }
      navigateToParent();
    } catch (cause) {
      const message =
        typeof cause === "object" &&
        cause !== null &&
        "message" in cause &&
        typeof cause.message === "string"
          ? cause.message
          : "Unable to delete user.";
      setError(message);
    }
  }

  const userName = state?.user?.name ?? state?.user?.email ?? "this user";

  return (
    <View title="Delete user">
      <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
        <div className="text-neutral-100">
          Are you sure you want to delete{" "}
          <span className="text-orange-500">{userName}</span>? This cannot be
          restored.
        </div>
        {error && (
          <p role="alert" className="text-red-400">
            {error}
          </p>
        )}
        <Button
          title="Delete"
          onPress={deleteUser}
          disabled={!state?.user?.id}
        />
        <Button
          title="Cancel"
          onPress={navigateToParent}
          className="bg-transparent border-neutral-300"
        />
      </div>
    </View>
  );
}
