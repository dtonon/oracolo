<script>
  // No JavaScript logic is needed for this simple loading animation
</script>

<div class="loader-container">
  <div class="loader"></div>
</div>

<style>
  .loader-container {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 80vh;
    background-color: rgb(250, 250, 250);
  }

  :global(html.dark) .loader-container {
    background-color: rgb(46, 46, 46);
  }

  .loader {
    display: inline-block;
    width: 92px;
    height: 92px;
    opacity: 0; /* Initially invisible */
    animation:
      fade-in 0.5s 0.4s forwards,
      loader-animation 2s linear infinite 0.4s; /* Fade-in animation and delay for loader animation */
  }

  .loader:after {
    content: ' ';
    display: block;
    width: 64px;
    height: 64px;
    margin: 8px;
    border-radius: 50%;
    border: 6px solid #a9a9a9;
    border-color: #a9a9a9 transparent #a9a9a9 transparent;
    animation: loader-animation 2s linear infinite;
  }

  :global(html.dark) .loader:after {
    border: 6px solid #373737;
    border-color: #373737 transparent #373737 transparent;
  }

  @keyframes loader-animation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes fade-in {
    to {
      opacity: 1;
    }
  }
</style>
