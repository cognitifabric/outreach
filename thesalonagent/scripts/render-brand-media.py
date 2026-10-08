"""Render original illustrative media using the public website's design tokens.

Requires Pillow and ffmpeg. No recordings, customer screenshots or payments are
created. The real configured voice preview is intentionally left untouched.
Usage: python render-brand-media.py --ffmpeg /path/to/ffmpeg
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import argparse
import json
import math
import subprocess

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "media"
W, H, FPS, DURATION = 1280, 720, 24, 40
INK, MUTED, BLUE = "#142137", "#4b596d", "#2456e8"
PALE, CORAL, LINE, WHITE = "#eef3ff", "#ff7863", "#dce2ee", "#ffffff"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")
REGULAR, BOLD = FONT_DIR / "Arial.ttf", FONT_DIR / "Arial Bold.ttf"

SCENES = [
    (0, 5, "CUSTOMER CALLS", "A customer calls. A booking starts.",
     "A customer calls about a service and asks for a preferred employee."),
    (5, 10, "AVAILABILITY CHECKED", "Your team. The right time.",
     "The assistant checks working hours, breaks, prices and the connected calendar."),
    (10, 16, "APPOINTMENT SAVED", "The appointment is in the calendar.",
     "The appointment is saved. The deposit is still pending."),
    (16, 23, "CUSTOMER TEXT", "The details. A deposit request.",
     "The customer receives details and a deposit request. This example sends no messages."),
    (23, 30, "TEAM VIEW", "Your team sees what needs attention.",
     "The team can see the appointment and pending deposit in one place."),
    (30, 35, "HUMAN ASSISTANCE", "A person, when the request needs one.",
     "Requests that need a person can be flagged for a callback."),
    (35, 40, "YOUR WORKFLOW NEXT", "See it work for your team.",
     "Illustrative workflow with fictional data. Book a demo for your team."),
]


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else REGULAR), size)


def txt(draw, xy, value, size=24, color=INK, bold=False):
    draw.multiline_text(xy, value, font=font(size, bold), fill=color, spacing=8)


def wrap(value, width, size=24, bold=False):
    lines, current = [], ""
    for word in value.split():
        candidate = (current + " " + word).strip()
        if font(size, bold).getlength(candidate) > width and current:
            lines.append(current)
            current = word
        else:
            current = candidate
    return "\n".join(lines + ([current] if current else []))


def box(draw, bounds, fill=WHITE, outline=LINE, radius=16):
    draw.rounded_rectangle(bounds, radius=radius, fill=fill, outline=outline, width=2)


def badge(draw, xy, label, fill=PALE, color=BLUE, size=16):
    width = math.ceil(font(size, True).getlength(label)) + 28
    x, y = xy
    box(draw, (x, y, x + width, y + 34), fill, None, 17)
    txt(draw, (x + 14, y + 8), label, size, color, True)
    return width


def row(draw, y, label, value, last=False):
    txt(draw, (88, y), label, 21, MUTED)
    txt(draw, (380, y - 1), value, 24, INK, True)
    if not last:
        draw.line((88, y + 39, 1192, y + 39), fill=LINE, width=1)


def scene(index, time=0):
    im = Image.new("RGB", (W, H), WHITE)
    d = ImageDraw.Draw(im)
    txt(d, (48, 26), "sa", 30, BLUE, True)
    d.polygon([(87, 22), (92, 28), (98, 32), (92, 36), (87, 43), (83, 36), (76, 32), (83, 28)], fill=CORAL)
    txt(d, (111, 29), "the salon agent", 24, INK, True)
    badge(d, (877, 24), "ILLUSTRATIVE EXAMPLE", size=14)
    d.line((48, 74, 1232, 74), fill=LINE, width=1)
    txt(d, (48, 96), f"{index + 1:02} / {SCENES[index][2]}", 15, BLUE, True)
    txt(d, (48, 125), SCENES[index][3], 43, INK, True)
    box(d, (48, 192, 1232, 567), PALE, "#cad6ef", 20)
    txt(d, (78, 210), "DEMO STUDIO / FICTIONAL CUSTOMER DATA", 13, MUTED, True)

    if index == 0:
        box(d, (78, 246, 1140, 347), "#f5f6fa", None, 12)
        txt(d, (102, 260), "ALEX / DEMO CUSTOMER", 14, MUTED, True)
        txt(d, (102, 293), "I'd like a classic lash set with Jordan on Tuesday.", 28)
        box(d, (134, 365, 1202, 466), WHITE, None, 12)
        txt(d, (158, 379), "MIA / AI RECEPTIONIST", 14, BLUE, True)
        txt(d, (158, 412), "Let's check Jordan's price and available times.", 28)
        for n in range(48):
            height = 8 + abs(math.sin(n * 1.41 + time * 4)) * 23
            x = 478 + n * 7
            d.rounded_rectangle((x, 522 - height / 2, x + 3, 522 + height / 2), radius=2, fill=BLUE)

    elif index == 1:
        row(d, 253, "Employee / service", "Jordan / Classic full set")
        row(d, 305, "Service price", "$120 / Fictional example")
        row(d, 357, "Working time", "Hours and breaks checked")
        badge(d, (88, 424), "2:00 PM", WHITE, BLUE, 24)
        badge(d, (276, 424), "4:00 PM", WHITE, BLUE, 24)
        txt(d, (88, 495), "Illustrative available times. Connected calendars guide the options.", 20, MUTED)

    elif index == 2:
        txt(d, (88, 249), "Tuesday, October 13", 29, INK, True)
        for n, hour in enumerate(["1 PM", "2 PM", "3 PM"]):
            y = 312 + n * 77
            txt(d, (88, y), hour, 19, MUTED)
            d.line((180, y + 13, 1192, y + 13), fill=LINE, width=1)
        box(d, (196, 364, 1192, 488), WHITE, "#b6c8ef", 12)
        d.rounded_rectangle((196, 365, 204, 487), radius=3, fill=BLUE)
        txt(d, (226, 380), "Alex Rivera / Classic full set", 28, INK, True)
        txt(d, (226, 422), "Jordan / 2:00 to 3:30 PM", 24, MUTED)
        badge(d, (900, 432), "$40 deposit pending", "#fff0de", "#7d4800", 16)
        txt(d, (88, 520), "Appointment saved. Payment remains pending.", 20, MUTED)

    elif index == 3:
        box(d, (88, 250, 1192, 421), WHITE, None, 14)
        txt(d, (112, 264), "MIA / SMS EXAMPLE", 14, BLUE, True)
        txt(d, (112, 301), "Alex, your appointment is saved for Tue Oct 13, 2 PM with Jordan.\nYour $40 deposit is pending.", 25)
        box(d, (112, 376, 436, 415), BLUE, None, 8)
        txt(d, (132, 385), "Deposit link / example only", 20, WHITE, True)
        txt(d, (88, 454), "Sent through your configured payment provider.", 25, INK, True)
        txt(d, (88, 505), "Illustration only. No text or payment is sent.", 20, MUTED)

    elif index == 4:
        for n, (label, value) in enumerate([
            ("Customer", "Alex Rivera"), ("Service", "Classic full set"),
            ("Employee / time", "Jordan / Oct 13, 2 PM"),
            ("Appointment", "Saved"), ("Deposit", "$40 / Pending"),
        ]):
            row(d, 254 + n * 53, label, value, n == 4)
        badge(d, (957, 516), "DEPOSIT PENDING", "#fff0de", "#7d4800", 13)

    elif index == 5:
        txt(d, (88, 253), "Callback requested", 32, INK, True)
        for n, label in enumerate(["Reason saved for the team", "Customer details captured", "Follow-up handled by a person"]):
            badge(d, (88, 316 + n * 62), f"0{n + 1}", WHITE, BLUE, 17)
            txt(d, (162, 321 + n * 62), label, 26)
        txt(d, (88, 524), "Live call transfer is not currently enabled.", 20, MUTED)

    else:
        txt(d, (88, 254), "Your team. Your prices. Your booking rules.", 34, INK, True)
        txt(d, (88, 323), "Calls and texts / Employee calendars / Deposit follow-up", 26, MUTED)
        box(d, (88, 405, 323, 470), BLUE, None, 9)
        txt(d, (118, 426), "Book a demo", 27, WHITE, True)
        txt(d, (88, 514), "Use the enquiry button below the video to get started.", 21, MUTED)

    txt(d, (48, 592), wrap(SCENES[index][4], 1184, 22), 22, INK)
    txt(d, (48, 678), "Illustrative workflow / Fictional data / No live booking or payment is created", 15, MUTED)
    d.rounded_rectangle((48, 656, 1232, 662), radius=3, fill=LINE)
    d.rounded_rectangle((48, 656, 48 + max(4, 1184 * min(1, time / DURATION)), 662), radius=3, fill=BLUE)
    return im


def stamp(seconds):
    return f"00:00:{seconds:02}.000"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ffmpeg", default="ffmpeg")
    args = parser.parse_args()
    for directory in ["graphics", "videos", "transcripts"]:
        (MEDIA / directory).mkdir(exist_ok=True)
    for index, name in [(2, "calendar-appointment-v3"), (3, "sms-next-step-v3"), (4, "team-booking-view-v3")]:
        scene(index, SCENES[index][0]).resize((1600, 900), Image.Resampling.LANCZOS).save(MEDIA / "graphics" / f"{name}.webp", quality=91, method=6)
    scene(0).save(MEDIA / "videos" / "booking-poster-v3.png")
    mp4 = MEDIA / "videos" / "booking-workflow-v3.mp4"
    command = [args.ffmpeg, "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "1280x720", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-profile:v", "baseline", "-level:v", "3.1", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(mp4)]
    with (MEDIA / "videos" / "render-v3.log").open("wb") as log:
        process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=log)
        for frame in range(DURATION * FPS):
            time = frame / FPS
            index = next(n for n, data in enumerate(SCENES) if data[0] <= time < data[1])
            process.stdin.write(scene(index, time).tobytes())
        process.stdin.close()
        if process.wait():
            raise RuntimeError("Video encoding failed; see render-v3.log")
    subprocess.run([args.ffmpeg, "-y", "-i", str(mp4), "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "32", "-row-mt", "1", "-deadline", "good", "-cpu-used", "4", str(MEDIA / "videos" / "booking-workflow-v3.webm")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    timeline = {"narrator": [{"speaker": "caption", "text": data[4], "start": data[0], "end": data[1]} for data in SCENES]}
    (MEDIA / "transcripts" / "booking-timeline-v3.json").write_text(json.dumps(timeline, indent=2) + "\n")
    (MEDIA / "transcripts" / "booking-captions-v3.vtt").write_text("WEBVTT\n\n" + "\n\n".join(f"{stamp(data[0])} --> {stamp(data[1])}\n{data[4]}" for data in SCENES) + "\n")
    print(json.dumps({"duration": DURATION, "dimensions": [W, H], "formats": ["H.264 MP4", "VP9 WebM"], "graphics": 3, "fictional": True}))


if __name__ == "__main__":
    main()
