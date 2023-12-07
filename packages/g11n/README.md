# g11n

The package builds on [formatjs](https://formatjs.io/) and
[react-intl](https://formatjs.io/docs/react-intl) to provide
a complete solution for small web applications and libraries.
The package is designed to be used with [React](https://reactjs.org/).

This library fills two gaps in the existing solutions:

- it provides a way to extract translations and generate final
  translation files by yourself, without relying on a third party
  service; you simply run the translation target that collects strings
  from your code, merges them with existing translations and generates
  the final translation files, all in one step; you can also point the
  script to dependencies that have similar translations and it will
  merge them with your translations;
- it provides for a way to retrieve the translations from the server
  and use them in the client through a custom provider.

To use this library in your project, install it using your favorite
package manager:

```bash
npm install @vebgen/g11n
pnpm install @vebgen/g11n
yarn add @vebgen/g11n
```
