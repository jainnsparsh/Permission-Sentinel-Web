"""
Permission Sentinel - Benchmark Evaluation Script
Evaluates the deterministic analysis engine against the 8 ground-truth test fixtures.
Computes accuracy, precision, recall, and score boundaries.
"""

import sys
from app.demo_data.fixtures import DEMO_APPS
from app.engine.analyzer import analyze_app


def run_evaluation():
    print("=" * 80)
    print("PERMISSION SENTINEL — GROUND TRUTH BENCHMARK EVALUATION")
    print("=" * 80)
    print(f"{'App Name':<16} | {'Purpose':<26} | {'Expected':<8} | {'Pred':<8} | {'Score':<5} | {'Range':<8} | {'Status'}")
    print("-" * 80)

    total = len(DEMO_APPS)
    band_correct = 0
    range_correct = 0

    # Binary classification metrics for High Risk vs Non-High Risk
    tp = 0  # Expected High, Pred High
    fp = 0  # Expected Non-High, Pred High
    tn = 0  # Expected Non-High, Pred Non-High
    fn = 0  # Expected High, Pred Non-High

    for app in DEMO_APPS:
        result = analyze_app(
            app_name=app["app_name"],
            package_name=app["package_name"],
            permissions=app["permissions"],
            purpose=app["purpose"],
            purpose_source=app.get("purpose_source", "provided"),
            input_source="demo-fixture",
        )

        expected_band = app["expected_risk_band"]
        pred_band = result["risk_band"]
        score = result["score"]
        expected_range = app["expected_score_range"]

        is_band_match = pred_band == expected_band
        is_range_match = expected_range[0] <= score <= expected_range[1]

        if is_band_match:
            band_correct += 1
        if is_range_match:
            range_correct += 1

        is_high_expected = expected_band == "High"
        is_high_pred = pred_band == "High"

        if is_high_expected and is_high_pred:
            tp += 1
        elif not is_high_expected and is_high_pred:
            fp += 1
        elif not is_high_expected and not is_high_pred:
            tn += 1
        elif is_high_expected and not is_high_pred:
            fn += 1

        status_str = "PASS" if is_band_match else "FAIL"
        range_str = f"[{expected_range[0]}-{expected_range[1]}]"
        purpose_trunc = app["purpose"][:24] + ".." if len(app["purpose"]) > 26 else app["purpose"]

        print(f"{app['app_name']:<16} | {purpose_trunc:<26} | {expected_band:<8} | {pred_band:<8} | {score:<5} | {range_str:<8} | {status_str}")

    print("=" * 80)
    band_acc = (band_correct / total) * 100
    range_acc = (range_correct / total) * 100
    
    precision = (tp / (tp + fp)) * 100 if (tp + fp) > 0 else 100.0
    recall = (tp / (tp + fn)) * 100 if (tp + fn) > 0 else 100.0

    print(f"Total Test Fixtures Evaluated : {total}")
    print(f"Risk Band Classification Acc  : {band_correct}/{total} ({band_acc:.1f}%)")
    print(f"Score Range Compliance        : {range_correct}/{total} ({range_acc:.1f}%)")
    print(f"High-Risk Anomaly Recall      : {recall:.1f}%")
    print(f"High-Risk Anomaly Precision   : {precision:.1f}%")
    print("=" * 80)

    if band_acc >= 85.0:
        print(">>> BENCHMARK EVALUATION PASSED (>= 85% Ground-Truth Alignment) <<<")
        return 0
    else:
        print(">>> BENCHMARK EVALUATION FAILED (Below required threshold) <<<")
        return 1


if __name__ == "__main__":
    sys.exit(run_evaluation())
