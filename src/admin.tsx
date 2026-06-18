/** Admin UI exports for the email plugin (loaded via the descriptor's adminEntry). */
import type { ComponentType } from "react";
import { EmailSettingsPage } from "./admin/EmailSettingsPage";

export const pages: Record<string, ComponentType> = {
	"/settings": EmailSettingsPage,
};

export const widgets: Record<string, ComponentType> = {};

export const fields: Record<string, ComponentType> = {};
