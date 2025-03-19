<script lang="ts">
  import { onMount } from 'svelte';

  let darkMode = false;
  let initialized = false;

  function handleSwitchDarkMode() {
    darkMode = !darkMode;

    // If the theme match the system, reset the preference and follow it, otherwise set the preference
    if (
      (localStorage.getItem('systemTheme') == 'dark' && darkMode) ||
      (localStorage.getItem('systemTheme') == 'light' && !darkMode)
    ) {
      localStorage.removeItem('theme');
    } else {
      localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }

    applyTheme(darkMode);
  }

  function applyTheme(isDark: boolean) {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  function determineTheme(): boolean {
    // First check for explicit user preference in localStorage
    if (localStorage.getItem('theme') === 'dark') {
      return true;
    } else if (localStorage.getItem('theme') === 'light') {
      return false;
    }

    // If no explicit preference, use system preference
    let darkSetting = window.matchMedia('(prefers-color-scheme: dark)').matches;
    localStorage.setItem('systemTheme', darkSetting ? 'dark' : 'light');
    return darkSetting;
  }

  onMount(() => {
    // Set the initial theme
    darkMode = determineTheme();
    applyTheme(darkMode);
    initialized = true;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      localStorage.setItem('systemTheme', event.matches ? 'dark' : 'light');
      // Only update based on system preference if user hasn't set a preference
      if (!localStorage.getItem('theme')) {
        darkMode = event.matches;
        applyTheme(darkMode);
      }
    };

    // Use the correct event listener based on browser support
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleSystemThemeChange);
    }

    // Clean up event listener on component destruction
    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      } else {
        // Fallback for older browsers
        mediaQuery.removeListener(handleSystemThemeChange);
      }
    };
  });
</script>

<div class={initialized ? 'visible' : 'hidden'}>
  <input checked={darkMode} on:change={handleSwitchDarkMode} type="checkbox" id="theme-toggle" />
  <label for="theme-toggle" />
</div>

<style>
  .hidden {
    visibility: hidden;
  }

  .visible {
    visibility: visible;
  }

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
