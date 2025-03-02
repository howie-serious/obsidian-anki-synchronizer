import { assert } from "console";
import { TFile, parseYaml, TAbstractFile, stringifyYaml } from "obsidian";
import AnkiSynchronizer from "main";

export interface Metadata {
	type: string,
	id: number,
	tags: Array<string>
}

export function getYAMLAndBody(raw: string): [object, string[]] {
	const lines = raw.split('\n');
	assert(lines.length >= 2 && lines[0].trim() == '---');
	const yamlLines: string[] = [];
	let index = 1;
	while (lines[index].trim() !== '---') {
		yamlLines.push(lines[index]);
		index += 1;
		if (index == lines.length) {
			throw new Error("Bad YAML");
		}
	}
	const yaml = parseYaml(yamlLines.join('\n')) as object;
	const body = lines.slice(index + 1);
	return [yaml, body]
}

export class Note {
	file: TFile;
	metadata: Metadata
	body: string[];
	plugin: AnkiSynchronizer;

	constructor(plugin: AnkiSynchronizer, file: TFile, metadata: Metadata, body: string[]) {
		this.plugin = plugin;
		this.file = file;
		this.metadata = metadata;
		this.body = body;
	}

	isNew() {
		return this.metadata.id === 0;
	}


	addID(id: number) {
		this.metadata.id = id;
		this.plugin.app.vault.modify(this.file, this.dump())
	}

	dump() {
		const yaml = stringifyYaml(this.metadata);
		return `---\n${yaml}---\n${this.body.join('\n')}\n`
	}

	renderBacklink = (basename: string) => {
		const url = "obsidian://open?vault=" + encodeURIComponent(this.plugin.app.vault.getName()) + String.raw`&file=` + encodeURIComponent(basename);
		return `[${basename}](${url})`
	}

	transformField(content: string) {
		return content.replace(/\[\[(\w+)\]\]/, (match, p) => {
			const backlink = this.renderBacklink(p);
			return `[${p}](${backlink})`
		});
	}

	parseFields() {
		const fieldNames = this.plugin.noteTypes[this.metadata.type];
		assert(fieldNames.length >= 2);
		const fields: Record<string, string> = {};
		fields[fieldNames[0]] = this.renderBacklink(this.file.basename);
		let fidx = 1;
		let buffer: Array<string> = [];
		for (const line of this.body) {
			if (line.slice(0, 2) === '# ') {
				fields[fieldNames[fidx]] = this.transformField(buffer.join('\n').trim() + '\n');
				buffer = [];
				fidx += 1;
				assert(line.slice(2).trim() === fieldNames[fidx])
			} else {
				buffer.push(line)
			}
		}
		fields[fieldNames[fidx]] = this.transformField(buffer.join('\n').trim() + '\n');
		return fields;
	}

	renderDeckName() {
		return (this.file as TAbstractFile).path.split('/').slice(0, -1).join('::');
	}
}
