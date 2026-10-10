# Affiliation marks

The five marks identify the institutions in the author list supplied by the project maintainer. They are sourced from each university's official website; exact asset URLs are recorded in `data/people.json`.

The HUST, Tsinghua, Wuhan University of Technology and University of Toronto header marks originally have white lettering for dark backgrounds. Their foregrounds are rendered in dark monochrome colors (purple for Tsinghua), preserving their original shapes, so they remain legible on the white Home page. Lehigh's mark retains its source colors. Images are scaled proportionally and saved as lossless WebP.

Logos remain the property of their respective universities and do not imply institutional endorsement. Run `python scripts/build_institution_assets.py` to regenerate the local assets (requests, Pillow and PyMuPDF required).
