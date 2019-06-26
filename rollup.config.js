import svelte from "rollup-plugin-svelte";
import { sass } from "svelte-preprocess-sass";
import scss from "rollup-plugin-scss";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import { terser } from "rollup-plugin-terser";

const production = !process.env.ROLLUP_WATCH;

export default {
  input: "src/app/main.js",
	output: {
		sourcemap: true,
		format: "iife",
		name: "app",
    file: "src/assets/bundle.js",
    globals: {
      "socket-iop": "io",
    },
	},
  external: [
    "socket-io",
  ],
	plugins: [
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file — better for performance
      emitCss: true,

      preprocess: {
        style: sass({}, {
          name: "scss",
        }),
      },
		}),

    // Import any SCSS files
    scss(),

		// If you have external dependencies installed from
		// npm, you'll most likely need these plugins. In
		// some cases you'll need additional configuration —
		// consult the documentation for details:
		// https://github.com/rollup/rollup-plugin-commonjs
		resolve({ browser: true }),
		commonjs(),

		// If we're building for production (npm run build
		// instead of npm run dev), minify
		production && terser()
	],
	watch: {
		clearScreen: false
	}
};
