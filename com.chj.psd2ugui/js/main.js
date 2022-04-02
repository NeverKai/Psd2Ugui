var onOutPutInfos = function ()
{
	//获取是否输出图片
	var isOutPutPngs = document.getElementById("isOutPutPngs").checked;
	//获取最大描边像素
	var maxOutlinePixel = document.getElementById("maxOutlinePixel").value;
	//获取最大渐变数量
	var maxGradientCount = document.getElementById("maxGradientCount").value;
	
	var cs = new CSInterface();
	cs.evalScript('outPutInfos("' + isOutPutPngs + '","' + Number(maxOutlinePixel) + '","' + Number(maxGradientCount) +'")');
}