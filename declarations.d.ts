declare module '*.png' {
  const value: any;
  export = value;
}

declare module '*.jpg' {
  const value: any;
  export = value;
}

declare module '*.jpeg' {
  const value: any;
  export = value;
}

declare module '*.webp' {
  const value: any;
  export = value;
}

// Vite `?raw` imports: the file's text, inlined into the bundle.
declare module '*?raw' {
  const content: string;
  export default content;
}
