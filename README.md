# Kairo Inventory

Redesign of the ArcaneMP inventory for Foundations 0.11.1. The Travel Bag uses a quill and ledger theme, groups items by gameplay category, and brings gear and mount controls into the same grid. It updates changed inventory rows automatically while open.

## Install

Requires a server running Foundations 0.11.1.

1. Stop the server and back up its inventory database.
2. Move the server's existing `resources/hmp-inventory` folder to a backup location outside `resources`.
3. Copy `resources/hmp-inventory` from this package into the server's `resources` directory. Keep the folder name `hmp-inventory` so dependent resources can find it.
4. Start the server, reconnect and press **F2** to open the Travel Bag.

Kairo uses the existing inventory tables and migration history. Keep only one inventory resource active.

### Install on Linux

Run these commands as the user that owns the server files. Stop the ArcaneMP process or container and back up its inventory database before replacing the resource. For a container or game panel, use the server's persistent volume directory as the server path.

Extract the release ZIP with `unzip Kairo-Inventory-0.1.0-rc.zip`, then set the paths below to your actual directories.

```sh
server="/path/to/arcane-server"
package="/path/to/Kairo-Inventory-0.1.0"
target="$server/resources/hmp-inventory"
backup="$server/kairo-backups/hmp-inventory-$(date +%Y%m%d-%H%M%S)"
staging="$server/kairo-backups/kairo-staging-$(date +%Y%m%d-%H%M%S)"

test -f "$target/package.json" &&
test -f "$package/resources/hmp-inventory/package.json" &&
test ! -e "$server/resources/kairo-inventory" &&
mkdir -p "$server/kairo-backups" &&
test ! -e "$backup" &&
test ! -e "$staging" &&
cp -a "$package/resources/hmp-inventory" "$staging" &&
mv "$target" "$backup" &&
{
  if mv "$staging" "$target"; then
    printf 'Original resource backup: %s\n' "$backup"
  else
    mv "$backup" "$target"
    printf 'Install failed. The original resource was restored.\n' >&2
    false
  fi
}
```

Start the server using your usual command or panel, reconnect and press **F2**. Keep the backup path printed by the command. To restore, follow the steps below using that backup.

[ArcaneMP server hosting guide](https://docs.arcane.mp/guides/hosting-a-server/run-a-server/)

## Restore the original inventory

Stop the server, move Kairo's `resources/hmp-inventory` folder out of `resources`, put the original folder back from your backup and restart.

## Configuration

Edit resources/hmp-inventory/config.js. English and F2 are the package defaults. Set language to it for Italian. Set broom, flying and ground to unused keys to enable mount shortcuts. A null key disables its shortcut. Restart and reconnect after editing.

Manual translations are in languages/it.js and languages/en.js. Keep the keys and placeholders in braces. Add a new dictionary to sharedScripts in package.json before languages/resolve.js. Missing keys fall back to Italian. Item labels and descriptions come from the server's item definitions.

F2, /inventory and /hmpinv open the bag. /borsa shows a text summary in chat.

## Credits and release status

The storage backend derives from hmp-inventory shipped in HogwartsMP Foundations v0.11.1. The notice accompanying that distribution is included in LICENSE-Foundations. Cinzel and Spectral include their OFL notices in ui/fonts.

This is a release candidate. Test character reconnect, item use, a shop purchase, a bank cash operation and a parcel transfer on a Foundations 0.11.1 test server before rolling it out. The public package uses generic category icons and a theme drawn in CSS and SVG.
