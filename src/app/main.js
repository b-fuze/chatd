import App from './App.html';

const app = new App({
	target: document.getElementById("app"),
	props: {
		name: 'world'
	}
});

export default app;
