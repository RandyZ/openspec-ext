# OpenSpec extension - build and publish
# OVSX_TOKEN can be set in .env (recommended) or in the environment.

.PHONY: publish-ovsx readme-marketplace icon-png

# Load .env if present, then package and publish to Open VSX (single shell so exports apply)
publish-ovsx:
	@[ -f .env ] && . ./.env; pnpm run package && pnpm run publish:openvsx

# Only extract "usage" part of README to build/README.md (for testing; does not run full package)
readme-marketplace:
	@node scripts/extract-readme-marketplace.js

# Convert resources/icon.svg to resources/icon.png (128px width for VS Code marketplace icon)
icon-png:
	@node scripts/icon-svg-to-png.js
