(() => {
  // Keep frequently tuned gameplay values in this small file so animation,
  // collision, and level-tuning changes do not create large game.js conflicts.
  window.IndiePlatformerConfig = Object.freeze({
    gravity: 1200,
    jumpVelocity: -460,
    maxFallSpeed: 900,
    walkSpeed: 230,
    runSpeed: 340,
    playerWidth: 24,
    crouchHeight: 34,
    standHeight: 50,
    playerVisualScale: 1.1,
    pulseSpeed: 620,
    pulseCooldown: 0.35,
    pulseDamage: 1,
    gravityFieldRadius: 260,
    gravityFlipDamping: 0.45,
    contactDamageCooldown: 0.8,
    fallLimit: 640,
    roomWidth: 1280,
    checkpoint: { x: 86, y: 362 },
    safeAnchor: { x: 92, y: 362 }
  });
})();
