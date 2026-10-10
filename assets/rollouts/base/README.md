# Nominal LIBERO task demonstrations

Source: [HuggingFaceVLA/libero](https://huggingface.co/datasets/HuggingFaceVLA/libero), version 2.1, revision `affa19c0de0f6bce2a7edd26dddef8a532e7e6f6`. The [dataset card at this revision](https://huggingface.co/datasets/HuggingFaceVLA/libero/blob/affa19c0de0f6bce2a7edd26dddef8a532e7e6f6/README.md) declares [Creative Commons Attribution 4.0 International](LICENSE.txt). LIBERO is by the [Lifelong Robot Learning team](https://github.com/Lifelong-Robot-Learning/LIBERO); dataset conversions are by OpenVLA, Physical Intelligence and the HuggingFace VLA team. The clips and posters retain this license.

These clips illustrate unperturbed base tasks. They are public dataset demonstrations, not evaluations of any model on this website. None of the website's private evaluation records were used to create them.

Each MP4 is converted from the source episode's `observation.images.image` frames, with H.264 encoding and no audio. Every clip uses the same 4× speedup: the original 10 fps sequence is encoded at 40 fps, retaining all source frames, their order and image orientation. The resulting complete clips last 2.1–9.575 seconds, depending on the original episode length. The WebP poster is the first source frame. The eight reviewed episodes below are pinned by ID and SHA-256 in the builder.

### Successful demonstrations

The source card identifies [physical-intelligence/libero](https://huggingface.co/datasets/physical-intelligence/libero), whose card traces its data to [openvla/modified_libero_rlds](https://huggingface.co/datasets/openvla/modified_libero_rlds). OpenVLA's [dataset regeneration script](https://github.com/openvla/openvla/blob/0ebc5e333ee7a916813bf50db240f1af7ba1d295/experiments/robot/libero/regenerate_libero_dataset.py) replays demonstrations and saves only episodes for which the environment returns success (`done`); it records terminal reward and done as 1. Failed replays are excluded before the format conversions.

The eight selected clips were also visually reviewed against their task instructions and completion frames, including both pots on the lit stove for Long 8. Success evidence is the upstream filtering and this visual review: the converted LeRobot files do not retain reward/done fields, and no new simulation evaluation was performed for this website. These are successful task demonstrations, not model-specific test results.

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
