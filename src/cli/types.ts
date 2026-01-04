export interface CliConfig {
  schemaPath: string;
  functionsPath: string;
  port: number;
  openBrowser: boolean;
}

export interface DetectedFiles {
  schemaPath: string | null;
  functionsPath: string | null;
}
