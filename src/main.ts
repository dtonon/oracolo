import './app.scss';
import App from './App.svelte';

console.log('running');

const app = new App({
	target: document.getElementById('app')!
});

export default app;

(window as any).destroySvelteApp = () => app.$destroy();
