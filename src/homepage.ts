import './homepage.scss';
import Homepage from './Homepage.svelte';

const app = new Homepage({
  target: document.getElementById('app')!
});

export default app;