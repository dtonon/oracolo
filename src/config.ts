export const getConfig = () => {
  const publicKeyMeta = document.querySelector('meta[name="publicKey"]');
  const relaysMeta = document.querySelector('meta[name="relays"]');

  if (!publicKeyMeta || !relaysMeta) {
    throw new Error("Missing meta tags for configuration");
  }

  const publicKey = publicKeyMeta.getAttribute('value');
  const relays = relaysMeta.getAttribute('value')?.split(',').map(url => url.trim());

  return { publicKey, relays };
};