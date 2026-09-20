from technique_titan.detection import anatomical_handedness
from technique_titan.detection.hand_detector import HandDetector


def test_anatomical_handedness_inverts_mirror_labels():
    assert anatomical_handedness("Left") == "Right"
    assert anatomical_handedness("Right") == "Left"


def test_anatomical_handedness_passthrough_unknown():
    assert anatomical_handedness("Unknown") == "Unknown"


def test_hand_detector_defaults_to_inverting_handedness():
    assert HandDetector.__init__.__defaults__ is not None
    # invert_handedness is the last constructor default
    assert HandDetector.__init__.__defaults__[-1] is True
