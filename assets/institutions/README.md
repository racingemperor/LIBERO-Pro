# Affiliation marks

The five marks identify the institutions in the author list supplied by the project maintainer. They are sourced from each university's official website; exact asset URLs are recorded in `data/people.json`.

The HUST, Tsinghua, Wuhan University of Technology and University of Toronto header marks originally have white lettering for dark backgrounds. Their foregrounds are rendered in dark monochrome colors (purple for Tsinghua), preserving their original shapes, so they remain legible on the white Home page. Lehigh uses the official horizontal shield-and-wordmark combination in its original colors. Transparent outer margins are trimmed before proportional scaling to lossless WebP; `width` and `height` in `data/people.json` record the resulting intrinsic dimensions. Home renders all visible marks at 36px high (30px on mobile), with natural widths and compact wrapping.

Logos remain the property of their respective universities and do not imply institutional endorsement. Run `python scripts/build_institution_assets.py` to regenerate the local assets (requests, Pillow and PyMuPDF required).
