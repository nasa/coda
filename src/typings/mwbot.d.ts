// there is no @types/mwbot, so this is a custom type to make the IDE errors go away
declare module "mwbot" {
  const MWBot: any; // Use `any` or a more specific type if you know the structure
  export = MWBot;
}
