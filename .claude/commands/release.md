Perform a full versioned release of the LedgerNest project. Follow these steps exactly:

1. **Read the current version** from the README.md badge (`version-X.Y.Z`).

2. **Determine the next version**: increment the patch number by 1 (e.g. 0.5.10 → 0.5.11). If the user passed an argument like `minor` bump the minor instead; if they passed an explicit version like `0.6.0` use that directly.

3. **Update README.md**: replace the old version badge with the new one.

4. **Stage and commit** all currently modified/untracked files that are relevant (never include `.env*`, `*.db`, `node_modules`). Use this commit message format:
   ```
   feat: v{NEW_VERSION} — {SHORT_DESCRIPTION}
   
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   ```
   Where `SHORT_DESCRIPTION` is a one-line summary of the changes being released. If the user provided a description as `$ARGUMENTS`, use that; otherwise derive it from the staged diff.

5. **Create a git tag**: `git tag v{NEW_VERSION}`

6. **Push** branch and tags: `git push origin main --tags`

7. **Create a GitHub Release** using the `gh` CLI:
   ```
   gh release create v{NEW_VERSION} --title "v{NEW_VERSION} — {SHORT_DESCRIPTION}" --notes "..."
   ```
   The release notes should be a short bullet-point summary of what changed, derived from the diff. Keep it concise (3–6 bullets max).

8. **Report** the release URL to the user.

**Language**: write the commit message, tag, release title and release notes in English.

User's argument (optional — release description or version override): $ARGUMENTS
