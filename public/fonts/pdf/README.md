These are self-hosted PDF export fonts from the Noto project, distributed under
the SIL Open Font License. See LICENSE-OFL.txt and LICENSE-CJK.txt. Copyright
notices remain in the font metadata.

Noto Sans, Serif and Sans Mono provide regular/bold/italic variants where present.
The editor's sans/rounded, serif and mono choices map to these PDF font families;
weights 600–800 map to bold, 400–500 to regular. Mono italic uses a synthetic skew.
CJK fallback uses regular Noto Sans JP.

Noto Sans JP is instanced at weight 400 and pre-subset into Unicode blocks. These
blocks avoid broken runtime CJK glyph subsetting and are loaded only when used.
Unsupported glyphs stop export with a clear error instead of being dropped.

Pinned upstream URLs, original/source checksums, transformation information and
output checksums are in manifest.json. To regenerate, run
`scripts/prepare-pdf-fonts.py` using fonttools==4.68.0 in a maintainer environment.
Python/fonttools are not needed by the application, deployment or normal builds.
