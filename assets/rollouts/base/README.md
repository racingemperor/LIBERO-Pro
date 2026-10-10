# Nominal LIBERO task demonstrations

The eight clips are newly recorded [X-VLA](https://github.com/2toinf/X-VLA) rollouts using the public [lerobot/xvla-libero checkpoint](https://huggingface.co/lerobot/xvla-libero/tree/12e8783e996944f5c97e490d37d4c145484ed70a) and the official [LIBERO simulator](https://github.com/Lifelong-Robot-Learning/LIBERO/tree/8f1084e3132a39270c3a13ebe37270a43ece2a01). They demonstrate unperturbed base tasks. They are selected successful examples and are not used to compute the website's leaderboard scores.

Each task starts from its official initial state. The simulator's task-specific success predicate must be false at the start and true at completion. The action sequence and success checks are retained in a local review directory; only the selected video and poster are published.

## Recording format

- Agent-view images are rendered directly by MuJoCo at **640 × 640**; no upscaling is used.
- The policy continues to receive its usual **256 × 256** camera observations.
- All eight clips use the same **4× speedup**: one frame per 20 Hz control step is encoded at 80 fps, retaining the initial frame and every action through success.
- A 180° display rotation matches LeRobot's agent-view convention. It does not change model inputs.
- The videos use silent H.264 / YUV420p with fast-start playback. WebP posters are also 640 × 640.

| Website task | Instruction |
|---|---|
| Spatial 0 | Pick up the black bowl between the plate and the ramekin and place it on the plate. |
| Spatial 8 | Pick up the black bowl next to the plate and place it on the plate. |
| Object 1 | Pick up the cream cheese and place it in the basket. |
| Object 8 | Pick up the chocolate pudding and place it in the basket. |
| Goal 3 | Open the top drawer and put the bowl inside. |
| Goal 6 | Put the cream cheese in the bowl. |
| Long 5 | Pick up the book and place it in the back compartment of the caddy. |
| Long 8 | Put both moka pots on the stove. |

The scene wording for Goal 6 uses “in the bowl”; the website retains its official benchmark instruction. Success is checked against the original scene predicate.

Run `python scripts/build_task_demos.py --review-dir EXTERNAL_REVIEW_DIRECTORY` to validate and install the selected media. The builder checks all eight task identities, BASE status, X-VLA provenance, simulator success traces, native-resolution metadata, decoded dimensions, frame counts and the common playback multiplier before replacing any files. Use `--check-only` to validate without copying. Private traces and evaluation records remain outside the public repository.

LIBERO is by the [Lifelong Robot Learning team](https://github.com/Lifelong-Robot-Learning/LIBERO), and X-VLA by its [authors](https://github.com/2toinf/X-VLA), with the model integration by [LeRobot](https://github.com/huggingface/lerobot). These demonstration videos and posters are shared under [Creative Commons Attribution 4.0 International](LICENSE.txt).
