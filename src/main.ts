import { Notice, Plugin } from "obsidian";
import { DEFAULT_SETTINGS, type BridgeSettings } from "./types";
import { TransportManager } from "./transport/manager";
import { CheckboxWatcher } from "./watcher";
import { QuickCaptureModal } from "./ui/quick-capture";
import { FLOWTASK_VIEW_TYPE, TaskView } from "./ui/task-view";
import { FlowTaskSettingTab } from "./settings";
import { COMMAND_NAMES } from "./commands";

declare const __FLOWTASK_CSS__: string;

export default class FlowTaskPlugin extends Plugin {
  override settings!: BridgeSettings;
  transport!: TransportManager;
  private watcher!: CheckboxWatcher;
  private pollingId?: number;

  override async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...(await this.loadData() as Partial<BridgeSettings> | null) };
    this.transport = new TransportManager(this.app, this.settings);
    this.watcher = new CheckboxWatcher(this.app, this.transport, this.settings.importTag);
    this.watcher.register(this.app.vault, (event) => this.registerEvent(event));
    this.registerView(FLOWTASK_VIEW_TYPE, (leaf) => new TaskView(
      leaf,
      this.transport,
      () => new QuickCaptureModal(this.app, this.transport).open(),
      (tasks) => this.watcher.syncRemoteCompletions(tasks),
      this.settings.projectOrder,
      async (projectOrder) => { this.settings.projectOrder = projectOrder; await this.saveSettings(); },
    ));
    this.addSettingTab(new FlowTaskSettingTab(this.app, this));
    this.addRibbonIcon("check-check", "Open FlowTask", () => void this.openPanel());
    this.registerCommands();
    this.restartPolling();
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => { void this.refreshPanel(); }));
    this.registerDomEvent(window, "focus", () => { void this.refreshPanel(); });
    this.addStyle();
  }

  override onunload(): void { this.app.workspace.detachLeavesOfType(FLOWTASK_VIEW_TYPE); }

  async saveSettings(): Promise<void> { await this.saveData(this.settings); this.transport.configure(); this.watcher?.configure(this.settings.importTag); }

  restartPolling(): void {
    if (this.pollingId) window.clearInterval(this.pollingId);
    this.pollingId = window.setInterval(() => { void this.refreshPanel(); }, Math.max(2, Math.min(30, this.settings.pollingSeconds)) * 1000);
    this.registerInterval(this.pollingId);
  }

  async openPanel(view?: "all" | "today"): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(FLOWTASK_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf("tab");
      await leaf.setViewState({ type: FLOWTASK_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    if (view) (leaf.view as TaskView).setView(view);
  }

  private async refreshPanel(): Promise<void> {
    const leaf = this.app.workspace.getLeavesOfType(FLOWTASK_VIEW_TYPE)[0];
    if (leaf?.view instanceof TaskView) await leaf.view.refresh();
    else await this.watcher.syncRemoteCompletions(await this.transport.refresh("active", true));
  }

  private registerCommands(): void {
    this.addCommand({ id: "sp-quick-capture", name: COMMAND_NAMES.quickCapture, callback: () => new QuickCaptureModal(this.app, this.transport).open() });
    this.addCommand({ id: "sp-sync-current-line", name: COMMAND_NAMES.syncCurrentLine, editorCallback: () => void this.watcher.syncCurrentLine() });
    this.addCommand({ id: "sp-open-panel", name: COMMAND_NAMES.openPanel, callback: () => void this.openPanel() });
    this.addCommand({ id: "sp-refresh", name: COMMAND_NAMES.refresh, callback: () => void this.refreshWithNotice() });
    this.addCommand({ id: "sp-today-view", name: COMMAND_NAMES.todayView, callback: () => void this.openPanel("today") });
  }

  private async refreshWithNotice(): Promise<void> { await this.refreshPanel(); new Notice(this.transport.state === "connected" ? "FlowTask refreshed." : "FlowTask refreshed in offline mode."); }

  private addStyle(): void {
    const style = document.createElement("style");
    style.id = "flowtask-styles";
    style.textContent = __FLOWTASK_CSS__;
    document.head.appendChild(style);
    this.register(() => style.remove());
  }
}
