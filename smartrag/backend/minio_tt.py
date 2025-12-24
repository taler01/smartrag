from minio import Minio
import os

# -----------------------------
# 1. 配置 MinIO 业务账号
# -----------------------------
MINIO_ENDPOINT = "115.236.102.133:9092"   # MinIO API 地址
MINIO_ACCESS_KEY = "backend-app"    # 业务账号
MINIO_SECRET_KEY = "backend-secret"
BUCKET_NAME = "upload"              # 你的 bucket

# 初始化客户端
client = Minio(
    MINIO_ENDPOINT,
    access_key="4Bd3KIo9y9TKF3i7aE95",
    secret_key="8Hp5tnDsLtVHgTeUwO2uIWiYy4FzO0yI1XSIhYc0",
    secure=False  # 本地部署一般为 False
)

# -----------------------------
# 2. 上传函数（永不过期）
# -----------------------------
def upload_file(file_path: str) -> str:
    if not os.path.exists(file_path):
        raise FileNotFoundError(file_path)

    object_name = os.path.basename(file_path)

    # 如果 bucket 不存在则创建
    if not client.bucket_exists(BUCKET_NAME):
        client.make_bucket(BUCKET_NAME)

    # 上传文件
    client.fput_object(
        bucket_name=BUCKET_NAME,
        object_name=object_name,
        file_path=file_path
    )

    # 直接返回访问 URL（假设 bucket 可公共访问）
    result = {
        "object_name": object_name,
        "url": f"http://{MINIO_ENDPOINT}/{BUCKET_NAME}/{object_name}"
    }
    return result

# -----------------------------
# 3. 测试上传
# -----------------------------
if __name__ == "__main__":
    local_file = "/home/seven/work/talor/rag/file_databases/public/4b/4b2408e4af7fc342a6b5b078db22012fa4ba151bffa56e204541ce077fa68cc5.docx"  # 替换成你要上传的文件
    url = upload_file(local_file)
    print("上传成功，可访问 URL:", url)
