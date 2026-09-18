import { Notice, PluginSettingTab, Setting, type App } from "obsidian";
import type FlowTaskPlugin from "./main";

export class FlowTaskSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: FlowTaskPlugin) { super(app, plugin); }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("FlowTask For Super Productivity").setHeading();
    containerEl.createEl("p", { cls: "flowtask-settings-help", text: "Connect Obsidian to the local Super Productivity app. The token is optional in modern SP versions." });
    containerEl.createEl("p", { cls: "flowtask-settings-help", text: "To import a note task, add the #sp tag (default) to its checkbox. You can change this tag below to avoid collisions with other automations." });

    new Setting(containerEl).setName("Base URL").setDesc("Usually http://127.0.0.1:3876").addText((text) => text.setPlaceholder("http://127.0.0.1:3876").setValue(this.plugin.settings.baseUrl).onChange(async (value) => { this.plugin.settings.baseUrl = value.trim().replace(/\/$/, "") || "http://127.0.0.1:3876"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Access token (optional)").setDesc("Leave empty if SP does not show a token under Settings → Misc → Local REST API.").addText((text) => { text.inputEl.type = "password"; text.setValue(this.plugin.settings.accessToken).onChange(async (value) => { this.plugin.settings.accessToken = value.trim(); await this.plugin.saveSettings(); }); });
    new Setting(containerEl).setName("Test connection").setDesc("Checks /health and a task request with conditional authentication.").addButton((button) => button.setButtonText("Test").setCta().onClick(async () => { button.setDisabled(true); const result = await this.plugin.transport.testConnection(); button.setDisabled(false); new Notice(result.message); }));
    new Setting(containerEl).setName("Refresh interval").setDesc("Between 2 and 30 seconds.").addSlider((slider) => slider.setLimits(2, 30, 1).setValue(this.plugin.settings.pollingSeconds).onChange(async (value) => { this.plugin.settings.pollingSeconds = value; await this.plugin.saveSettings(); this.plugin.restartPolling(); }));
    new Setting(containerEl).setName("File fallback").setDesc("Queues operations when SP is offline.").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableFileFallback).onChange(async (value) => { this.plugin.settings.enableFileFallback = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Fallback folder").setDesc("A folder relative to the vault root, suitable for sync.").addText((text) => text.setValue(this.plugin.settings.fallbackFolder).onChange(async (value) => { this.plugin.settings.fallbackFolder = value.trim() || "FlowTask"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Default project").addText((text) => text.setValue(this.plugin.settings.defaultProjectName).onChange(async (value) => { this.plugin.settings.defaultProjectName = value.trim(); await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Import tag").setDesc("Only checkboxes with this tag are sent to SP. Default: #sp.").addText((text) => text.setValue(`#${this.plugin.settings.importTag}`).onChange(async (value) => { this.plugin.settings.importTag = value.trim().replace(/^#/, "") || "sp"; text.setValue(`#${this.plugin.settings.importTag}`); await this.plugin.saveSettings(); }));
  }
}
