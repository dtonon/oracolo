<script lang="ts">
	let darkMode = true;

	function handleSwitchDarkMode() {
		darkMode = !darkMode;

		localStorage.setItem('theme', darkMode ? 'dark' : 'light');

		darkMode
			? document.documentElement.classList.add('dark')
			: document.documentElement.classList.remove('dark');
	}

	// Check if the code is running in the browser
	if (typeof window !== 'undefined') {
		if (
			localStorage.theme === 'dark' ||
			(!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.classList.add('dark');
			darkMode = true;
		} else {
			document.documentElement.classList.remove('dark');
			darkMode = false;
		}
	}
</script>

<div>
	<input checked={darkMode} on:click={handleSwitchDarkMode} type="checkbox" id="theme-toggle" />
	<label for="theme-toggle" />
</div>

<style>
	#theme-toggle {
		display: none;
	}

	#theme-toggle + label {
		display: inline-block;
		cursor: pointer;
		height: 1rem;
		width: 1rem;
		position: absolute;
		top: 1rem;
		right: 3rem;
		border-radius: 9px;
		transition-duration: 300ms;
		content: '';

		@media only screen and (max-width: 768px) {
			right: 1rem;
		}
	}

	#theme-toggle:not(:checked) + label {
		background-color: #e9e9e9;
	}

	#theme-toggle:checked + label {
		background-color: transparent;
		box-shadow: inset -6px -6px 1px 1px #3f3f3f;
	}
</style>
