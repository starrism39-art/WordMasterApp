# WordMaster Export Sans

The local export feature embeds two build-time font subsets from the Google Fonts
repository. `NotoSansSC[wght].ttf` supplies GB2312 Simplified Chinese, while
`NotoSans[wdth,wght].ttf` supplies Latin and IPA. Both subsets are instantiated
at weight 400, remove hinting, and are renamed under the `WordMaster Export
Sans` family.

- Upstream copyright: Copyright 2014-2021 Adobe
- IPA subset copyright: Copyright 2022 The Noto Project Authors
- Upstream license: SIL Open Font License 1.1
- Upstream source: https://github.com/google/fonts/tree/main/ofl/notosanssc
- IPA source: https://github.com/google/fonts/tree/main/ofl/notosans
- Reserved Font Name declared upstream: `Source`
- Packaged resource: Brotli-compressed TrueType, decompressed locally through
  `FileSystemManager.readCompressedFileSync`

The complete upstream licenses are included in `OFL.txt` and
`OFL-NotoSans.txt`. Generated PDFs are not subject to the font license merely
because they embed these fonts.
