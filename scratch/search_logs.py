import json

log_path = r"C:\Users\Yamir\.gemini\antigravity\brain\23da867c-3365-4fa6-aaba-c7404b4080e1\.system_generated\logs\transcript.jsonl"

queries = ["texto", "textos", "script", "guion", "script de video", "tutorial", "imagen"]

matches = []
with open(log_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            data = json.loads(line)
            content = data.get("content", "")
            # check if any query is in content
            found = False
            for q in queries:
                if q.lower() in content.lower():
                    found = True
                    break
            if found:
                # Store a summary
                step_idx = data.get("step_index", i)
                source = data.get("source", "")
                type_ = data.get("type", "")
                # Snippet of content
                snippet = content[:300] + "..." if len(content) > 300 else content
                matches.append({
                    "step": step_idx,
                    "source": source,
                    "type": type_,
                    "snippet": snippet
                })
        except Exception as e:
            pass

print(f"Total matches: {len(matches)}")
# Print the last 15 matches which represent the most recent discussion about texts
for m in matches[-25:]:
    print(f"Step {m['step']} | Source: {m['source']} | Type: {m['type']}")
    print(f"  {m['snippet']}")
    print("-" * 50)
