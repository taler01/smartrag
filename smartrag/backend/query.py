import requests
import json
import httpx


url = "http://10.168.27.191:8888/rag/query"

# 表单数据（multipart/form-data）
data = {
    "query": "农机故障",
    "knowledge_name": "knowledge_AFTER_SALES",
    # 如果后端期望布尔字符串，请使用 "False" 或 "True"
    "only_retrieve": "True"
}

def http_post_httpx(url, data, timeout=15):
    def parse_chunk(chunk):
        rag_contents, rag_files = [], []
        for i in range(0,len(chunk)):
            rag_contents.append(f"文献[{i+1}]:{chunk[i]['content']}")
            rag_files.append(f"文献[{i+1}]:{chunk[i]['file_path']}")
        return rag_contents, rag_files
    try:
        with httpx.Client() as client:
            resp = client.post(url, data=data, timeout=timeout)
            resp.raise_for_status()
            print("\nChunks from data:")
            data_dict = resp.json().get("data", {})
            if not isinstance(data_dict, dict):
                print(f"Unexpected data type: {type(data_dict)}, expected dict")
                # print("Response data:", data_dict)
                return None, None
            chunks = data_dict.get("chunks", [])
            if not isinstance(chunks, list):
                print(f"Unexpected chunks type: {type(chunks)}, expected list")
                # print("Chunks data:", chunks)
                return None, None
            if len(chunks) == 0:
                print("No chunks found in response.")
                return None, None
            else:
                rag_contents, rag_files = [], []
                if len(chunks) > 3:
                    chunks_seleted = chunks[:3]
                    rag_contents, rag_files = parse_chunk(chunks_seleted)
                    return rag_contents, rag_files
                rag_contents, rag_files = parse_chunk(chunks)
                return rag_contents, rag_files
                    
    except httpx.HTTPStatusError as e:
        print("HTTP error:", e, resp.text if 'resp' in locals() else "")
    except httpx.RequestError as e:
        print("Request failed:", e)


if __name__ == "__main__":
    data, file = http_post_httpx(url, data)
    print("Rag contents:", data)
    print("Rag files:", file)
