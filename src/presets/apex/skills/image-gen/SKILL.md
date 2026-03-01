# image-gen

Generate images using OpenAI DALL-E 3 API and send them to the current channel.

## When to use
- User asks to generate, create, or draw an image
- User asks for artwork, illustrations, logos, mockups, or visual content
- NOT for: image analysis/understanding (use the built-in `image` tool instead)

## Prerequisites
- `OPENAI_API_KEY` must be set in the shell environment (e.g. ~/.zshrc)
- If the key is missing, inform the user and skip gracefully

## How to use

Run the generation script:

```bash
source ~/.zshrc
python3 "$(dirname "$0")/generate.py" --prompt "YOUR PROMPT" [--size 1024x1024] [--quality standard] [--style vivid]
```

### Parameters
- `--prompt` (required): Image description. Write detailed, descriptive prompts in English for best results. Translate user's prompt to English if needed.
- `--size`: 1024x1024 (default), 1792x1024 (landscape), 1024x1792 (portrait)
- `--quality`: standard (default) or hd
- `--style`: vivid (default) or natural

### Output
The script prints the local file path of the saved image on success.

### Sending the image
After generation, use the `message` tool with `filePath` or `media` pointing to the output path to send it to the user's channel.

## Example workflow

```bash
# Generate
source ~/.zshrc
OUTPUT=$(python3 /path/to/generate.py --prompt "a futuristic cityscape at sunset" --size 1792x1024 --quality hd)
```

Then send via message tool with the output path.

## Error handling
- API key missing: print error, exit 1
- API error (rate limit, billing): print error message, exit 1
- Network error: print error, exit 1
