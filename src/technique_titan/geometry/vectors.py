"""Shared vector/angle primitives used by all criterion feature extractors.

All functions accept a (21, 3) landmark array (rows indexed by the constants
in geometry.landmarks) or plain 3-vectors, and work in any consistent
coordinate system (image-normalized or world meters).
"""

from __future__ import annotations

import numpy as np

from . import landmarks as L


def vector(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Vector from point a to point b."""
    return np.asarray(b, dtype=float) - np.asarray(a, dtype=float)


def distance(a: np.ndarray, b: np.ndarray) -> float:
    return float(np.linalg.norm(vector(a, b)))


def angle_between(u: np.ndarray, v: np.ndarray) -> float:
    """Angle in degrees between two vectors (0..180)."""
    nu, nv = np.linalg.norm(u), np.linalg.norm(v)
    if nu == 0 or nv == 0:
        return float("nan")
    cos = np.clip(np.dot(u, v) / (nu * nv), -1.0, 1.0)
    return float(np.degrees(np.arccos(cos)))


def angle_at_joint(a: np.ndarray, b: np.ndarray, c: np.ndarray) -> float:
    """Interior angle at point b formed by segments b->a and b->c, in degrees.

    A perfectly straight joint reads ~180 deg; a right-angle bend reads 90 deg.
    """
    return angle_between(vector(b, a), vector(b, c))


def finger_joint_angles(points: np.ndarray, chain: tuple) -> dict:
    """PIP and DIP joint angles (degrees) for one finger chain (mcp,pip,dip,tip)."""
    mcp, pip, dip, tip = (points[i] for i in chain)
    return {
        "pip": angle_at_joint(mcp, pip, dip),
        "dip": angle_at_joint(pip, dip, tip),
    }


def palm_span(points: np.ndarray) -> float:
    """Distance between index MCP and pinky MCP — the scale reference."""
    return distance(points[L.INDEX_MCP], points[L.PINKY_MCP])


def normalize_landmarks(points: np.ndarray) -> np.ndarray:
    """Translate so the wrist is the origin and scale by palm span.

    Makes measurements invariant to camera distance and hand size
    (PRD FR-PD-4).
    """
    points = np.asarray(points, dtype=float)
    span = palm_span(points)
    if span == 0:
        raise ValueError("Degenerate hand: palm span is zero")
    return (points - points[L.WRIST]) / span


def fit_plane(points: np.ndarray) -> tuple:
    """Best-fit plane through points via SVD.

    Returns (centroid, unit_normal). Distances of a point p from the plane are
    dot(p - centroid, unit_normal).
    """
    points = np.asarray(points, dtype=float)
    centroid = points.mean(axis=0)
    _, _, vh = np.linalg.svd(points - centroid)
    return centroid, vh[-1]


def point_plane_distance(p: np.ndarray, centroid: np.ndarray, normal: np.ndarray) -> float:
    """Signed distance of point p from the plane (centroid, normal)."""
    return float(np.dot(np.asarray(p, dtype=float) - centroid, normal))
