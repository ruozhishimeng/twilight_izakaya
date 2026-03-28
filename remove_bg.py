"""
使用 rembg 库去除图片背景
用法: python remove_bg.py <输入图片路径> [输出图片路径]
"""

from rembg import remove
from PIL import Image
import sys
import os

def remove_background(input_path, output_path=None):
    """
    去除图片背景

    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径（可选，默认在输入文件名前加 "nobg_"）
    """
    if not os.path.exists(input_path):
        print(f"错误: 文件不存在 - {input_path}")
        return

    # 如果没有指定输出路径，则在输入文件名前加 "nobg_"
    if output_path is None:
        filename, ext = os.path.splitext(input_path)
        output_path = f"{filename}_nobg.png"

    print(f"正在处理: {input_path}")

    # 读取图片
    input_image = Image.open(input_path)

    # 去除背景
    output_image = remove(input_image)

    # 保存结果（保留 alpha 通道为 PNG）
    output_image.save(output_path, "PNG")
    print(f"完成! 保存为: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python remove_bg.py <输入图片路径> [输出图片路径]")
        print("示例: python remove_bg.py input.png output.png")
        print("       python remove_bg.py input.png  # 输出为 input_nobg.png")
    else:
        input_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else None
        remove_background(input_path, output_path)
