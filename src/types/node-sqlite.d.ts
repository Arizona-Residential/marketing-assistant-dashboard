declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...args: any[]): void;
      get(...args: any[]): any;
      all(...args: any[]): any;
    };
  }
}
