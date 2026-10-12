"""Curly quotes and apostrophes, so the devotional text matches the Scripture typography."""
import re


def smart(s):
    s = re.sub(r'"(\S[^"]*?)"', "“\\1”", s)
    return s.replace("'", "’")
