# Nominal LIBERO task demonstrations

Source: [HuggingFaceVLA/libero](https://huggingface.co/datasets/HuggingFaceVLA/libero), version 2.1, revision `affa19c0de0f6bce2a7edd26dddef8a532e7e6f6`. The source dataset declares [Apache License 2.0](LICENSE.txt). LIBERO is by the [Lifelong Robot Learning team](https://github.com/Lifelong-Robot-Learning/LIBERO).

These clips illustrate unperturbed base tasks. They are public dataset demonstrations, not evaluations of any model on this website. None of the website's private evaluation records were used to create them.

Each MP4 is converted from the source episode's `observation.images.image` frames at the recorded 10 fps, with H.264 encoding and no audio. All frames, their order, orientation and original duration are retained. The WebP poster is the first frame. The earliest episode with the matching instruction is selected deterministically.

| Website task | Source task index | Source episode | Source instruction |
|---|---:|---:|---|
| Spatial 0 | 34 | 1272 | pick up the black bowl between the plate and the ramekin and place it on the plate |
| Spatial 8 | 36 | 1280 | pick up the black bowl next to the plate and place it on the plate |
| Object 1 | 22 | 810 | pick up the cream cheese and place it in the basket |
| Object 8 | 29 | 823 | pick up the chocolate pudding and place it in the basket |
| Goal 3 | 12 | 382 | open the top drawer and put the bowl inside |
| Goal 6 | 13 | 384 | put the cream cheese in the bowl |
| Long 5 | 9 | 27 | pick up the book and place it in the back compartment of the caddy |
| Long 8 | 6 | 10 | put both moka pots on the stove |

Source episodes are available at `https://huggingface.co/datasets/HuggingFaceVLA/libero/blob/affa19c0de0f6bce2a7edd26dddef8a532e7e6f6/data/chunk-{episode_index // 1000:03d}/episode_{episode_index:06d}.parquet`.

The source conversion uses shortened instruction wording, including “in the bowl” for Goal 6. The website retains its official task instruction and BASE goal predicate. Dataset-wide task indices are distinct from the zero-based IDs within each LIBERO suite.

Rebuild with `scripts/build_task_demos.py`. Downloaded datasets and visual review artifacts are kept in the required external `--review-dir`, not distributed with the website.
