import { Notice, PluginSettingTab, Setting, type App, type SettingDefinitionItem } from "obsidian";
import type FlowTaskPlugin from "./main";
import type { BridgeSettings } from "./types";

export class FlowTaskSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: FlowTaskPlugin) { super(app, plugin); }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("General").setHeading();
    containerEl.createEl("p", { cls: "flowtask-settings-help", text: "Connect Obsidian to the local Super Productivity app. The token is optional in modern SP versions." });
    containerEl.createEl("p", { cls: "flowtask-settings-help", text: "To import a note task, add the #sp tag (default) to its checkbox. You can change this tag below to avoid collisions with other automations." });

    new Setting(containerEl).setName("Base URL").setDesc("Usually http://127.0.0.1:3876").addText((text) => text.setPlaceholder("http://127.0.0.1:3876").setValue(this.plugin.settings.baseUrl).onChange(async (value) => { this.plugin.settings.baseUrl = value.trim().replace(/\/$/, "") || "http://127.0.0.1:3876"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Access token (optional)").setDesc("Leave empty when local SP does not require authentication. If configured, it is sent as Bearer on authenticated requests; /health is always unauthenticated.").addText((text) => { text.inputEl.type = "password"; text.setValue(this.plugin.settings.accessToken).onChange(async (value) => { this.plugin.settings.accessToken = value.trim(); await this.plugin.saveSettings(); }); });
    new Setting(containerEl).setName("Test connection").setDesc("Checks /health and a task request with conditional authentication.").addButton((button) => button.setButtonText("Test").setCta().onClick(async () => { button.setDisabled(true); const result = await this.plugin.transport.testConnection(); button.setDisabled(false); new Notice(result.message); }));
    new Setting(containerEl).setName("Refresh interval").setDesc("Between 2 and 30 seconds.").addSlider((slider) => slider.setLimits(2, 30, 1).setValue(this.plugin.settings.pollingSeconds).onChange(async (value) => { this.plugin.settings.pollingSeconds = value; await this.plugin.saveSettings(); this.plugin.restartPolling(); }));
    new Setting(containerEl).setName("File fallback").setDesc("Queues operations when SP is offline.").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableFileFallback).onChange(async (value) => { this.plugin.settings.enableFileFallback = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Fallback folder").setDesc("A folder relative to the vault root, suitable for sync.").addText((text) => text.setValue(this.plugin.settings.fallbackFolder).onChange(async (value) => { this.plugin.settings.fallbackFolder = value.trim() || "FlowTask"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Default project").addText((text) => text.setValue(this.plugin.settings.defaultProjectName).onChange(async (value) => { this.plugin.settings.defaultProjectName = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Import tag").setDesc("Only checkboxes with this tag are sent to SP. Default: #sp.").addText((text) => text.setValue(`#${this.plugin.settings.importTag}`).onChange(async (value) => { this.plugin.settings.importTag = value.trim().replace(/^#/, "") || "sp"; text.setValue(`#${this.plugin.settings.importTag}`); await this.plugin.saveSettings(); }));
  }

  override getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Connection",
        items: [
          { name: "Base URL", desc: "Usually http://127.0.0.1:3876", control: { type: "text", key: "baseUrl", defaultValue: "http://127.0.0.1:3876" } },
          {
            name: "Access token (optional)",
            desc: "Leave empty when local SP does not require authentication. If configured, it is sent as Bearer on authenticated requests; /health is always unauthenticated.",
            render: (setting) => {
              setting.setName("Access token (optional)").setDesc("Leave empty when local SP does not require authentication. If configured, it is sent as Bearer on authenticated requests; /health is always unauthenticated.").addText((text) => { text.inputEl.type = "password"; text.setValue(this.plugin.settings.accessToken).onChange(async (value) => { this.plugin.settings.accessToken = value.trim(); await this.plugin.saveSettings(); }); });
            },
          },
          { name: "Refresh interval", desc: "Between 2 and 30 seconds.", control: { type: "slider", key: "pollingSeconds", defaultValue: 5, min: 2, max: 30, step: 1 } },
          { name: "Test connection", desc: "Checks /health and a task request with conditional authentication.", action: () => { void this.testConnection(); } },
        ],
      },
      {
        type: "group",
        heading: "Task import",
        items: [
          { name: "Default project", control: { type: "text", key: "defaultProjectName", defaultValue: "" } },
          { name: "Import tag", desc: "Only checkboxes with this tag are sent to SP. Default: #sp.", control: { type: "text", key: "importTag", defaultValue: "sp", placeholder: "#sp" } },
        ],
      },
      {
        type: "group",
        heading: "Offline fallback",
        items: [
          { name: "File fallback", desc: "Queues operations when SP is offline.", control: { type: "toggle", key: "enableFileFallback", defaultValue: true } },
          { name: "Fallback folder", desc: "A folder relative to the vault root, suitable for sync.", control: { type: "text", key: "fallbackFolder", defaultValue: "FlowTask" } },
        ],
      },
    ];
  }

  override getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  override async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (!(key in settings)) return;
    if (key === "importTag") settings[key] = String(value).replace(/^#/, "").trim() || "sp";
    else if (key === "pollingSeconds") settings[key] = Number(value);
    else settings[key] = value;
    await this.plugin.saveSettings();
    if (key === "pollingSeconds") this.plugin.restartPolling();
  }

  private async testConnection(): Promise<void> {
    const result = await this.plugin.transport.testConnection();
    new Notice(result.message);
  }
}
