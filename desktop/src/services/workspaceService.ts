import { invoke } from "@tauri-apps/api/core";
import { DbWorkspace } from "../types/db";

export class WorkspaceService {
  /**
   * Create a new workspace configuration
   */
  static async createWorkspace(path: string, name: string): Promise<DbWorkspace> {
    try {
      return await invoke<DbWorkspace>("create_workspace", { path, name });
    } catch (error) {
      console.error("Failed to create workspace:", error);
      throw error;
    }
  }

  /**
   * Select and activate a workspace by ID
   */
  static async openWorkspace(workspaceId: string): Promise<boolean> {
    try {
      return await invoke<boolean>("open_workspace", { workspaceId });
    } catch (error) {
      console.error(`Failed to open workspace ${workspaceId}:`, error);
      throw error;
    }
  }
}
export default WorkspaceService;
