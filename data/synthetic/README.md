# Synthetic feature rows

`feature_rows.csv` is geometry for the **82** `f*` label rows (`fexcellent/`, `fgood/`, `fwarning/`, `fcritical/`). Those rows do not need a photo on disk. The columns match `processed/batch_summary.csv`, so `technique_titan.ml.train` can merge them with a real batch summary.

Regenerate from the labels file:

```sh
python -m technique_titan.ml.synthetic \
  --labels data/labels.csv \
  --output data/synthetic/feature_rows.csv
```

The generator does not render hands. For each `f*` label row it draws metric values that fall inside the target severity band by inverting the piecewise YAML score (`sample_metric`), then fills the other feature columns around those values. It is a companion set for fitting, not evidence of hold-out accuracy. Eval still scores the frozen real-image ids separately. See [`src/technique_titan/ml/README.md`](../../src/technique_titan/ml/README.md).
