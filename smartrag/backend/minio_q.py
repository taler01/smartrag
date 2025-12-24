from minio import Minio
from minio.error import S3Error

# MinIO 服务地址（不带 http:// 或 https://）
minio_endpoint = "115.236.102.133:9092"
# 初始化 Minio 客户端
client = Minio(
    endpoint=minio_endpoint,
    access_key="5k2ojVFa3SfEi8Ba2byA",
    secret_key="55zc33NtzVmPN4WQo1XmNRZ1jHsKPOHuitSKXt1j",
    secure=False  # 如果是 HTTPS，改为 True
)

# 要操作的 bucket
bucket_name = "upload"

try:
    # 列出 bucket 中所有对象
    objects = client.list_objects(bucket_name, recursive=True)
    print(f"Bucket '{bucket_name}' 中的对象有：")
    for obj in objects:
        print(obj.object_name)
        
except S3Error as err:
    print("MinIO 错误:", err)
