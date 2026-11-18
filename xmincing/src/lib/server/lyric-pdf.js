import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const palette = [
	[1, 0.89, 0.7],
	[0.86, 0.94, 0.79],
	[0.8, 0.92, 1],
	[0.95, 0.85, 1],
	[1, 0.83, 0.86],
	[0.81, 0.95, 0.93],
	[0.92, 0.9, 0.84],
	[0.88, 0.88, 1]
];

function printable(value, font) {
	return Array.from(value, (character) => {
		try {
			font.encodeText(character);
			return character;
		} catch {
			return '?';
		}
	}).join('');
}

function wrap(value, font, size) {
	const lines = [];
	let line = '';
	for (const word of printable(value, font).split(/\s+/)) {
		const next = line ? line + ' ' + word : word;
		if (font.widthOfTextAtSize(next, size) <= 490) {
			line = next;
			continue;
		}
		if (line) lines.push(line);
		line = '';
		for (const character of word) {
			if (font.widthOfTextAtSize(line + character, size) > 490) {
				lines.push(line);
				line = '';
			}
			line += character;
		}
	}
	if (line) lines.push(line);
	return lines;
}

export async function lyricPdf(room, cover, mime) {
	const pdf = await PDFDocument.create();
	const font = await pdf.embedFont(StandardFonts.Helvetica);
	const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
	const image = mime === 'image/png' ? await pdf.embedPng(cover) : await pdf.embedJpg(cover);
	const names = JSON.parse(room.host_answers).map((entry) => entry.name);
	let page = pdf.addPage([570, 760]);
	let y = 720;
	function write(text, size, face = font, color) {
		for (const line of wrap(text, face, size)) {
			if (y < 55) {
				page = pdf.addPage([570, 760]);
				y = 720;
			}
			if (color)
				page.drawRectangle({
					x: 36,
					y: y - 4,
					width: face.widthOfTextAtSize(line, size) + 8,
					height: size + 7,
					color: rgb(...color)
				});
			page.drawText(line, { x: 40, y, size, font: face, color: rgb(0.15, 0.13, 0.14) });
			y -= size + 9;
		}
	}
	write('LYRIC DRAFT AND CREDITS', 11, bold);
	write(room.lyrics.split('\n')[0], 26, bold);
	const scaled = image.scaleToFit(210, 210);
	page.drawImage(image, { x: 40, y: y - scaled.height, ...scaled });
	y -= scaled.height + 25;
	for (const line of JSON.parse(room.lyric_credits)) {
		if (y < 130) {
			page = pdf.addPage([570, 760]);
			y = 720;
		}
		write(line.text, 14, bold, line.players.length ? palette[line.players[0] - 1] : undefined);
		if (line.players.length)
			write('Inspired by ' + line.players.map((player) => names[player - 1]).join(', '), 10);
		y -= 8;
	}
	return pdf.save();
}
