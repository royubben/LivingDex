# LivingDex v3.6.37 — Quilava Hisui Bias + Sync Safety

- Canonical entry: `quilava|hisui|156|main`
- Replaced the old duplicate `cobblemon-hisui-bias-quilava` entry in the main LivingDex.
- Removed the duplicate Regional Bias page copy so the entry exists exactly once.
- Uses `sprites/0156_Quilava_Hisui-bias.webp`.
- Startup cloud sync now merges local/cloud state, Journey events and Feed activity instead of overwriting the cloud with a stale local snapshot when local-dirty is present.
- This prevents a local older Feed copy from deleting newer cloud activity during login/reload.
