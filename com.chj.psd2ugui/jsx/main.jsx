// 作者：chj
// QQ：1216948100

var sceneData;
var sourcePsd;
var duppedPsd;
var destinationFolder;
var uuid;
var sourcePsdName;
var isOutPutPngs;
var maxOutlinePixel;
var maxGradientCount;

function outPutInfos( _isOutPutPngs, _maxOutlinePixel, _maxGradientCount ){
	isOutPutPngs = _isOutPutPngs;
	maxOutlinePixel = _maxOutlinePixel;
	maxGradientCount = _maxGradientCount;
	
    // got a valid document?
    if (app.documents.length <= 0)
    {
        if (app.playbackDisplayDialogs != DialogModes.NO)
        {
            alert("You must have a document open to export!");
        }
        // quit, returning 'cancel' makes the actions palette not record our script
        return 'cancel';
    }

    // ask for where the exported files should go
    destinationFolder = Folder.selectDialog("Choose the destination for export.");
    if (!destinationFolder)
    {
        return;
    }

    // cache useful variables
    uuid = 1;
    sourcePsdName = app.activeDocument.name;
    var layerCount = app.documents[sourcePsdName].layers.length;
    var layerSetsCount = app.documents[sourcePsdName].layerSets.length;

    if ((layerCount <= 1) && (layerSetsCount <= 0))
    {
        if (app.playbackDisplayDialogs != DialogModes.NO)
        {
            alert("You need a document with multiple layers to export!");
            // quit, returning 'cancel' makes the actions palette not record our script
            return 'cancel';
        }
    }

    // setup the units in case it isn't pixels
    var savedRulerUnits = app.preferences.rulerUnits;
    var savedTypeUnits = app.preferences.typeUnits;
    app.preferences.rulerUnits = Units.PIXELS;
    app.preferences.typeUnits = TypeUnits.PIXELS;

    alert("开始");
    try {
            // duplicate document so we can extract everythng we need
            duppedPsd = app.activeDocument.duplicate();
            
            //merge cut mask
            //first remove hided grouped layers and hided normal layer has grouped layers
            var artLayers = app.activeDocument.artLayers;
            var layerSets = app.activeDocument.layerSets;
            var hidedGroupedLayerArray = new Array();
            findGroupedLayers( artLayers, hidedGroupedLayerArray );
            findGroupedLayersInLayerSets( layerSets, hidedGroupedLayerArray );
            deleteLayers( hidedGroupedLayerArray );
            
            //second delete hided layers and layersets
            artLayers = app.activeDocument.artLayers;
            layerSets = app.activeDocument.layerSets;
            var hidedLayerArray = new Array();
            var hidedLayerSetArray = new Array();
            findHideLayer( artLayers, hidedLayerArray );
            findHideLayersInLayerSet( layerSets, hidedLayerArray, hidedLayerSetArray );
            deleteLayers( hidedLayerArray );
            deleteLayers( hidedLayerSetArray );
            
            //and then rasterize layer sheet
            artLayers = app.activeDocument.artLayers;
            layerSets = app.activeDocument.layerSets;
            rasterizeLayers( artLayers );
            rasterizeLayersInLayerSets( layerSets );
            
            //finally merge grouped layers
            artLayers = app.activeDocument.artLayers;
            layerSets = app.activeDocument.layerSets;
            var toBeMergeLayerArray = new Array();
            getAllGroupedLayers( artLayers, toBeMergeLayerArray );
            getAllGroupedLayersInLayerSets( layerSets, toBeMergeLayerArray );
            var cannotMergeLayerArray = new Array();
            mergeGroupedLayers( toBeMergeLayerArray, cannotMergeLayerArray );
            deleteLayers( cannotMergeLayerArray );
            
            //return;
            
            duppedPsd.activeLayer = duppedPsd.layers[duppedPsd.layers.length - 1];

            hideAllLayers(duppedPsd);
    } catch (error) {
        alert(error)
    }


    // export layers
    sceneData = "<?xml version=\"1.0\" encoding=\"utf-8\"?>";
    sceneData += "<PSDUI>";
    
    sceneData += "\n<psdSize>";
    sceneData += "<width>" + duppedPsd.width.value + "</width>";
    sceneData += "<height>" + duppedPsd.height.value+ "</height>";
    sceneData += "</psdSize>";
    sceneData += "\n<layers>";
    
    exportAllLayers(duppedPsd);
    
    sceneData += "</layers>";
    sceneData += "\n</PSDUI>";
    $.writeln(sceneData);

    //duppedPsd.close(SaveOptions.DONOTSAVECHANGES);

    // create export
    var sceneFile = new File(destinationFolder + "/" + destinationFolder.name + ".xml");
    sceneFile.encoding = "utf-8";   //写文件时指定编码，不然中文会出现乱码
    sceneFile.open('w');
    sceneFile.writeln(sceneData);
    sceneFile.close();

    app.preferences.rulerUnits = savedRulerUnits;
    app.preferences.typeUnits = savedTypeUnits;
	
	duppedPsd.close(SaveOptions.DONOTSAVECHANGES);
	alert("完成！");
}

function deleteLayers( layerArray )
{
	var len = layerArray.length;
	//alert(layerArray.toString());
	for( var i = 0;i < len;i++)
	{
		var currentLayer = layerArray.pop();
		try
		{
			if( currentLayer.allLocked )
			{
				currentLayer.allLocked = false;
			}
			currentLayer.remove();
		}
		catch(err)
		{
			//alert(currentLayer);
			alert(err);
		}
	}
}

function findHideLayer( artLayers, layerArray )
{
	if( artLayers == "undefined" )
	{
		return;
	}
	for(var i = artLayers.length - 1;i >= 0;i--)
	{
		if(artLayers[i].visible == false)
		{
			layerArray.push( artLayers[i] );
		}
	}
}

function findHideLayersInLayerSet( layerSets, layerArray, layerSetArray )
{
	if( layerSets == "undefined" )
	{
		return;
	}
	for(var i = layerSets.length - 1;i >= 0;i--)
	{
		findHideLayer( layerSets[i].artLayers, layerArray );		
		if(layerSets[i].visible == true)
		{
			findHideLayersInLayerSet( layerSets[i].layerSets, layerArray, layerSetArray );
		}
		else
		{
			layerSetArray.push( layerSets[i] );
		}
	}
}

function rasterizeLayerSheet()
{
	var idrasterizeLayer = stringIDToTypeID( "rasterizeLayer" );
    var desc11 = new ActionDescriptor();
    var idnull = charIDToTypeID( "null" );
	var ref5 = new ActionReference();
	var idLyr = charIDToTypeID( "Lyr " );
	var idOrdn = charIDToTypeID( "Ordn" );
	var idTrgt = charIDToTypeID( "Trgt" );
	ref5.putEnumerated( idLyr, idOrdn, idTrgt );
    desc11.putReference( idnull, ref5 );
    var idWhat = charIDToTypeID( "What" );
    var idrasterizeItem = stringIDToTypeID( "rasterizeItem" );
    var idlayerStyle = stringIDToTypeID( "layerStyle" );
    desc11.putEnumerated( idWhat, idrasterizeItem, idlayerStyle );
	executeAction( idrasterizeLayer, desc11, DialogModes.NO );
}

function rasterizeLayers( layers )
{
	var len = layers.length;
	for(var i = 0;i < len;i++)
	{
		if(layers[i].kind == LayerKind.TEXT)
		{
			continue;
		}
		app.activeDocument.activeLayer = layers[i];
		rasterizeLayerSheet();
	}
}

function rasterizeLayersInLayerSets( layerSets )
{
	for(var i = layerSets.length - 1;i >= 0;i--)
	{
		rasterizeLayers( layerSets[i].artLayers );
		rasterizeLayersInLayerSets( layerSets[i].layerSets );
	}
}

//根据当前图层获取下一个图层(或图层组)，需要判断是否有下一个图层
//这里和grouped搭配使用，若当前图层grouped属性为true，则必定有下一个图层或图层组
function getNextLayer( currentLayer )
{
	var parentLayer = currentLayer.parent;
	for(var i = 0;i<parentLayer.layers.length;i++)
	{
		if(parentLayer.layers[i] == currentLayer)
		{
			return parentLayer.layers[i + 1];
		}
	}
	return "undefined";
}

//获取当前图层所有的剪贴蒙版图层并返回
function getAllGroupedLayersInLayer( currentLayer )
{
	var groupedLayers = new Array();
	var parentLayer = currentLayer.parent;
	for(var i = parentLayer.layers.length - 1;i >= 0;i--)
	{
		if(parentLayer.layers[i] == currentLayer)
		{
			for(var j = i-1;j >=0;j--)
			{
				if(parentLayer.layers[j].grouped)
				{
					groupedLayers.push(parentLayer.layers[j]);
				}
				else
				{
					break;
				}
			}
			break;
		}
	}
	return groupedLayers;
}

function arrayContainsKey( array, key )
{
	for(var i = 0;i < array.length;i++)
	{
		if(array[i] == key)
		{
			return true;
		}
	}
	return false;
}

function findGroupedLayers( layers, layerArray )
{
	for(var i = layers.length - 1;i >= 0;i--)
	{
		if( layers[i].grouped )
		{
			var nextLayer = getNextLayer( layers[i] );
			if( nextLayer.visible == false && nextLayer.grouped == false)
			{
				var groupedLayers = getAllGroupedLayersInLayer( nextLayer );
				if( !arrayContainsKey( layerArray, nextLayer ) )
				{
					layerArray.push( nextLayer );
				}
				for(var j = groupedLayers.length - 1;j >= 0;j--)
				{
					if( !arrayContainsKey( layerArray, groupedLayers[j] ) )
					{
						layerArray.push( groupedLayers[j] );
					}
				}
				continue;
			}
			if( layers[i].visible == false )
			{
				if( !arrayContainsKey( layerArray, layers[i] ) )
				{
					layerArray.push( layers[i] );
				}
			}
		}
	}
}

function findGroupedLayersInLayerSets( layerSets, layerArray )
{
	for(var i = layerSets.length - 1;i >= 0;i--)
	{
		findGroupedLayers( layerSets[i].artLayers, layerArray );
		findGroupedLayersInLayerSets( layerSets[i].layerSets, layerArray );
	}
}

function getAllGroupedLayers( layers, layerArray )
{
	for(var i = 0;i < layers.length;i++)
	{
		if( layers[i].grouped )
		{
			layerArray.push( layers[i] );
		}
	}
}

function getAllGroupedLayersInLayerSets( layerSets, layerArray )
{
	for(var i = layerSets.length - 1;i >= 0;i--)
	{
		getAllGroupedLayers( layerSets[i].artLayers, layerArray );
		getAllGroupedLayersInLayerSets( layerSets[i].layerSets, layerArray );
	}
}

function mergeGroupedLayers( layerArray, toBeRemoveLayerArray )
{
	var len = layerArray.length;
	for(var i = 0;i < len;i++)
	{
		var currentLayer = layerArray.pop();
		var nextLayer = getNextLayer( currentLayer );
		if( nextLayer.typename == "ArtLayer" )
		{
			if( nextLayer.kind == LayerKind.SOLIDFILL)
			{
				nextLayer.rasterize( RasterizeType.SHAPE );
				currentLayer.merge();
			}
			else if( nextLayer.kind == LayerKind.NORMAL )
			{
				currentLayer.merge();
			}
			else if( artLayerArray[k].kind == LayerKind.SMARTOBJECT )
			{
				nextLayer.rasterize( RasterizeType.LINKEDLAYERS );
				currentLayer.merge();
			}
			else if( nextLayer.kind == LayerKind.TEXT )
			{
				if( !arrayContainsKey( toBeRemoveLayerArray, currentLayer ))
				{
					toBeRemoveLayerArray.push( currentLayer );
				}
				//TODO report to log and export log
			}
		}
		else if( nextLayer.typename == "LayerSet" )
		{
			var artLayerArray = new Array();
			getArtLayerArrayInLayerSet( nextLayer, artLayerArray );
			var count_1 = artLayerArray.length;
			for(var k = 0;k < count_1;k++)
			{
				var currentLayer_1 = artLayerArray.pop();
				if( currentLayer_1.kind == LayerKind.NORMAL )
				{
					var duplicateLayer = currentLayer.duplicate();
					duplicateLayer.move( currentLayer_1, ElementPlacement.PLACEBEFORE );
					duplicateLayer.grouped = true;
					duplicateLayer.merge();
				}
				else if( currentLayer_1.kind == LayerKind.SOLIDFILL )
				{
					var duplicateLayer = currentLayer.duplicate();
					currentLayer_1.rasterize( RasterizeType.SHAPE );
					duplicateLayer.move( currentLayer_1, ElementPlacement.PLACEBEFORE );
					duplicateLayer.grouped = true;
					duplicateLayer.merge();
				}
				else if( currentLayer_1.kind == LayerKind.SMARTOBJECT )
				{
					var duplicateLayer = currentLayer.duplicate();
					currentLayer_1.rasterize( RasterizeType.LINKEDLAYERS );
					duplicateLayer.move( currentLayer_1, ElementPlacement.PLACEBEFORE );
					duplicateLayer.grouped = true;
					duplicateLayer.merge();
				}
				else if( currentLayer_1.kind == LayerKind.TEXT )
				{
					//TODO report to log and export log
				}
			}
			if( !arrayContainsKey( toBeRemoveLayerArray, currentLayer ))
			{
				toBeRemoveLayerArray.push( currentLayer );
			}
		}
	}
}

function getArtLayerArrayInLayerSet( layerSet, artLayerArray )
{
	for(var i = 0;i < layerSet.artLayers.length;i++)
	{
		artLayerArray.push(layerSet.artLayers[i]);
	}
	for(var i = 0;i < layerSet.layerSets.length;i++)
	{
		getArtLayerArrayInLayerSet( layerSet.layerSets[i], artLayerArray );
	}
}

function exportAllLayers(obj)
{
    if  (typeof(obj) == "undefined"){
        return;
    }

    if (typeof(obj.layers) != "undefined" && obj.layers.length>0) {
        for (var i = obj.layers.length - 1; 0 <= i; i--)
        {
            exportLayer(obj.layers[i])
        }
    }
    else{
        exportLayer(obj)
    };
}

function exportLayer(obj)
{
    if  (typeof(obj) == "undefined"){
        return;
    }

    alert("exportLayer " + obj.name);
    if (obj.typename == "LayerSet") {
            exportLayerSet(obj);
    }
    else if  (obj.typename = "ArtLayer"){
        app.activeDocument.acviveLayer = obj;
        exportArtLayer(obj);
    }
}

function exportLayerSet(_layer)
{
    if (typeof(_layer.layers) == "undefined" || _layer.layers.length<=0 )
    {
        return
    }
    
    if(_layer.allLocked)
    {
        alert(_layer.name);
        exportLockLayers(_layer);
        _layer.visible = false;
    }
    else
    {
        alert("1" + _layer.name);
        sceneData += "<Layer>";
        sceneData += "<type>Normal</type>";
        sceneData += "<name>" + _layer.name + "</name>";    
        sceneData += "<layers>";
        exportAllLayers(_layer)
        sceneData += "</layers>";
        sceneData += "</Layer>";
    }
}

function setLayerSizeAndPos(layer)
{
    layer.visible = true;

    var recSize = getLayerRec(duppedPsd.duplicate());

    sceneData += "<position>";
    sceneData += "<x>" + recSize.x + "</x>";
    sceneData += "<y>" + recSize.y + "</y>";
    sceneData += "</position>";

    sceneData += "<size>";
    sceneData += "<width>" + recSize.width + "</width>";
    sceneData += "<height>" + recSize.height + "</height>";
    sceneData += "</size>";

    layer.visible = false;
    
    return recSize;
}

function exportArtLayer(obj)
{
    if (typeof(obj) == "undefined") {return};
    if (obj.name.search("@Size") >= 0) {return};

    sceneData += "\n<Layer>";
    sceneData += "<type>Normal</type>";
    
    var validFileName = makeValidFileName(obj.name);
    sceneData += "<name>" + validFileName + "</name>";
    sceneData += "<image>\n";
    if (LayerKind.TEXT == obj.kind)
    {
        exportLabel(obj,validFileName);
    }
    else
    {
        exportImage(obj,validFileName,isOutPutPngs);
    }
    sceneData += "</image>";
    
    sceneData += "\n</Layer>";
}

function exportLockLayers(obj)
{
    if (typeof(obj) == "undefined") {return};
    if (obj.name.search("@Size") >= 0) {return};

    sceneData += "\n<Layer>";
    sceneData += "<type>Normal</type>";
    alert("exportLockLayers" + obj.name);
    obj.allLocked = false;
    try {
        var name =  obj.name;
        var dupLayer = obj.duplicate();
        duppedPsd.activeLayer = dupLayer;

        for (var index = 0; index < dupLayer.layers.length; index++) {
            var element = dupLayer.layers[index];
            element.visible = true;
        }

        var mergeLayer = dupLayer.merge();
        mergeLayer.allLocked = false;
        duppedPsd.activeLayer = mergeLayer;
        mergeLayer.copy();
        var newPsd = addDocument(1);
        app.activeDocument = newPsd;
        newPsd.paste();
       
        var validFileName = makeValidFileName(name);
        sceneData += "<name>" + validFileName + "</name>";
        sceneData += "<image>\n";
        exportLayerSetImage(newPsd, validFileName,isOutPutPngs);
        sceneData += "</image>";
        obj.allLocked = true;
        sceneData += "\n</Layer>";

    } catch (error) {
        alert(error);
    }
}

function addDocument(index) {
	var docName = app.activeDocument.name;
	var orignalDoc = app.activeDocument;
	return app.documents.add(orignalDoc.width, orignalDoc.height,
		orignalDoc.resolution, docName + index, NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
}

function exportLabel(obj,validFileName)
{
	var sceneDataTemp = "";
    sceneDataTemp += "<imageType>" + "Label" + "</imageType>\n";
    sceneDataTemp += "<name>" + validFileName + "</name>\n";
	
    sceneDataTemp += "<arguments>";
    sceneDataTemp += "<color>" + obj.textItem.color.rgb.hexValue + "</color>";
    sceneDataTemp += "<font>" + obj.textItem.font + "</font>";
    sceneDataTemp += "<fontSize>" + Math.round(obj.textItem.size.value) + "</fontSize>";
    sceneDataTemp += "<content>" + obj.textItem.contents + "</content>";
    // 透明度
    sceneDataTemp += "<opacity>" + Math.round(obj.opacity) * Math.round(obj.fillOpacity) / 100 +"</opacity>";
    //描边
    obj.visible = true;
    app.activeDocument.activeLayer = obj;
    var currentDesc = getActiveLayerDescriptor();

    var layerEffectsID = getID( "layerEffects" );
    if(currentDesc.hasKey(layerEffectsID))
    {
        var layerEffectsDesc = currentDesc.getObjectValue(layerEffectsID);
        var frameFXID = getID("frameFX");
        if(layerEffectsDesc.hasKey(frameFXID)){
            var frameFXDesc = layerEffectsDesc.getObjectValue(frameFXID);
            var colorID = getID("color");
            var opacity = frameFXDesc.getDouble(getID("opacity"));
			var size = frameFXDesc.getDouble(getID("size"));
			//若描边像素大于设置的描边像素，则输出为图片
			if( Number(size) > maxOutlinePixel )
			{
				app.activeDocument.activeLayer = obj;
				RasterizedTextLayer();
				exportImage(obj,validFileName,isOutPutPngs);
				return;
			}
            if(frameFXDesc.hasKey(colorID) && frameFXDesc.getBoolean(1701732706))
            {
                var colorDesc = frameFXDesc.getObjectValue(colorID);
                var rgbTxt = descToColorList(colorDesc);
                var rgbHexTxt = changeToHex(rgbTxt);
                sceneDataTemp += "<outline>\n";
                sceneDataTemp += "<color>" + rgbHexTxt + "</color>";
                sceneDataTemp += "<opacity>" + opacity + "</opacity>";
                sceneDataTemp += "</outline>";
            }
        }

        var gradientFillID = getID("gradientFill");
        if(layerEffectsDesc.hasKey(gradientFillID))
		{
            var gradientFillDesc = layerEffectsDesc.getObjectValue(gradientFillID);
            var gradientID = getID("gradient");
            if(gradientFillDesc.hasKey(gradientID) && gradientFillDesc.getBoolean(1701732706))
            {
                var gradientDesc = gradientFillDesc.getObjectValue(gradientID);
                var transparencyList = gradientDesc.getList(getID("transparency"));
                var colorList = gradientDesc.getList(getID("colors"));
				//若渐变色值数量大于设置的数量，则栅格化图层并输出为图片
                if(transparencyList.count > maxGradientCount || colorList.count > maxGradientCount)
                {
					app.activeDocument.activeLayer = obj;
					RasterizedTextLayer();
					exportImage(obj,validFileName,isOutPutPngs);
					return;
                }
                sceneDataTemp += "<gradient>";
                var colorID = getID("color");
                for(var i = 0;i < 2;i++)
                {
                    if(colorList.getObjectValue(i).hasKey(colorID))
                    {
                        var colorDesc = colorList.getObjectValue(i).getObjectValue(colorID);
                        var rgbTxt = descToColorList(colorDesc);
                        var rgbHexTxt = changeToHex(rgbTxt);
                        sceneDataTemp += "<color" + i + ">" + rgbHexTxt +"</color" + i + ">\n";
                        sceneDataTemp += "<opacity" + i + ">" + transparencyList.getObjectValue(i).getDouble(getID("opacity")) + "</opacity" + i + ">\n";
                    }
                }
                sceneDataTemp += "</gradient>";
            }
        }
    }
    sceneDataTemp += "</arguments>";
	//此步骤为获取文本层的位置和大小，不需要输出图片
    saveScenePng(duppedPsd.duplicate(), validFileName, false);
	obj.visible = false;
	
	sceneData += sceneDataTemp;
}

function exportImage(obj,validFileName,isOutPutPngs)
{
    sceneData += "<name>" + validFileName + "</name>\n";
    sceneData += "<imageSource>" + "Custom" + "</imageSource>\n";    
    sceneData += "<imageType>" + "Image" + "</imageType>\n";

    obj.visible = true;
	if(isOutPutPngs == "true")
	{
		saveScenePng(duppedPsd.duplicate(), validFileName, true);
	}
    if(isOutPutPngs == "false")
	{
		saveScenePng(duppedPsd.duplicate(), validFileName, false);
	}
    obj.visible = false;
}

function exportLayerSetImage(psd, validFileName,isOutPutPngs)
{
    sceneData += "<name>" + validFileName + "</name>\n";
    sceneData += "<imageSource>" + "Custom" + "</imageSource>\n";    
    sceneData += "<imageType>" + "Image" + "</imageType>\n";

    psd.visible = true;
	if(isOutPutPngs == "true")
	{
		saveScenePng(psd, validFileName, true);
	}
    if(isOutPutPngs == "false")
	{
		saveScenePng(psd, validFileName, false);
	}
}


function hideAllLayers(obj)
{
    hideLayerSets(obj);
}

function hideLayerSets(obj)
{
    for (var i = obj.layers.length - 1; 0 <= i; i--)
    {
        if (obj.layers[i].typename == "LayerSet")
        {
            hideLayerSets(obj.layers[i]);
        }
        else
        {
            obj.layers[i].visible = false;
        }
    }
}

//显示图层组及组下所有图层
function showAllLayers(obj)
{
    showLayerSets(obj);
}

function showLayerSets(obj)
{
    for (var i = obj.layers.length - 1; 0 <= i; i--)
    {
        if (obj.layers[i].typename == "LayerSet")
        {
            showLayerSets(obj.layers[i]);
        }
        else
        {
            obj.layers[i].visible = true;
        }
    }
}


function getLayerRec(psd,notMerge)
{
    // we should now have a single art layer if all went well
    if  (!notMerge){
          psd.mergeVisibleLayers();
        }
  
    // figure out where the top-left corner is so it can be exported into the scene file for placement in game
    // capture current size
    var height = psd.height.value;
    var width = psd.width.value;
    var top = psd.height.value;
    var left = psd.width.value;
    // trim off the top and left
    psd.trim(TrimType.TRANSPARENT, true, true, false, false);
    // the difference between original and trimmed is the amount of offset
    top -= psd.height.value;
    left -= psd.width.value;
    // trim the right and bottom
    psd.trim(TrimType.TRANSPARENT);
    // find center
    top += (psd.height.value / 2)
    left += (psd.width.value / 2)
    // unity needs center of image, not top left
    top = -(top - (height / 2));
    left -= (width / 2);

    height = psd.height.value;
    width = psd.width.value;

    psd.close(SaveOptions.DONOTSAVECHANGES);

    return {
        y: top,
        x: left,
        width: width,
        height: height
    };
}

function saveScenePng(psd, fileName, writeToDisk,notMerge)
{
    // figure out where the top-left corner is so it can be exported into the scene file for placement in game
    // capture current size
    var height = psd.height.value;
    var width = psd.width.value;
    var top = psd.height.value;
    var left = psd.width.value;
    // trim off the top and left
    psd.trim(TrimType.TRANSPARENT, true, true, false, false);
    // the difference between original and trimmed is the amount of offset
    top -= psd.height.value;
    left -= psd.width.value;
    // trim the right and bottom
    psd.trim(TrimType.TRANSPARENT);
    // find center
    top += (psd.height.value / 2)
    left += (psd.width.value / 2)
    // unity needs center of image, not top left
    top = -(top - (height / 2));
    left -= (width / 2);

    height = psd.height.value;
    width = psd.width.value;

    var rec = {
        y: top,
        x: left,
        width: width,
        height: height
    };

    // save the scene data
    if(!notMerge){
        sceneData += "<position>";
        sceneData += "<x>" + rec.x + "</x>";
        sceneData += "<y>" + rec.y + "</y>";
        sceneData += "</position>";

        sceneData += "<size>";
        sceneData += "<width>" + rec.width + "</width>";
        sceneData += "<height>" + rec.height + "</height>";
        sceneData += "</size>";
    }
    
     if (writeToDisk)
     {
        // save the image
        var pngFile = new File(destinationFolder + "/" + fileName + ".png");
        
        var pngSaveOptions = new ExportOptionsSaveForWeb();
        pngSaveOptions.format = SaveDocumentType.PNG;
        pngSaveOptions.PNG8 = false;
		pngSaveOptions.quality = 100;
        psd.exportDocument(pngFile,ExportType.SAVEFORWEB,pngSaveOptions);
    }
    psd.close(SaveOptions.DONOTSAVECHANGES);

}

function makeValidFileName(fileName)
{
    var validName = fileName.replace(/^\s+|\s+$/gm, ''); // trim spaces
    //删除九宫格关键字符
    validName = validName.replace(/\s*_9S(\:\d+)+/g,"");
	
	// 删除渐变色关键字
	validName = validName.replace(/\s*_JB(\:[a-zA-Z0-9]+)+/g,"");
	
	// 删除outline
	validName = validName.replace(/\s*_OL(\:[a-zA-Z0-9]+)+/g,"");
	
    validName = validName.replace(/[\\\*\/\?:"\|<>]/g, ''); // remove characters not allowed in a file name
    validName = validName.replace(/[ ]/g, '_'); // replace spaces with underscores, since some programs still may have troubles with them
	
    if (validName.match("Common") || 
		validName.match("Global") ||
		validName.match("CustomAtlas"))
    {
        validName = validName.substring (0,validName.lastIndexOf ("@"));  //截取@之前的字符串作为图片的名称。
    }
    else if(!sourcePsdName.match("Common") ||
			!sourcePsdName.match("Global") ||
			!sourcePsdName.match("CustomAtlas"))    // 判断是否为公用的PSD素材文件，如果不是，则自动为图片增加后缀，防止重名。 公用psd文件的图片层不允许重名。
    {
        validName += "_" + uuid++;
    }
    
     $.writeln(validName);
    return validName;
}

// 裁切 基于透明像素
function trim(doc){
    doc.trim(TrimType.TRANSPARENT,true,true,true,true);
}

//Action Descriptor///////////////////////////////////////////////////////////////////////////////////////////
function getActiveLayerDescriptor()
{
	var ref = new ActionReference();
	ref.putEnumerated(char2Type("Lyr "), char2Type("Ordn"), char2Type("Trgt"));
	return executeActionGet(ref);
}

function char2Type(charId)
{
	return app.charIDToTypeID(charId);
}

function getID(str)
{
    return app.stringIDToTypeID( str );
}

function changeToHex(rgbTxt)
{
	var value = "";
	for(var i = 0, len = rgbTxt.length; i < len; i++)
	{
		var string = rgbTxt[i].toString(16);
		if(string.length < 2)
		{
			string = "0" + string;
		}
		value += string;
	}
	return value;
}

function roundColor(x) 
{
    x = Math.round(x);
    return (x > 255) ? 255 : x;
}

function descToColorList( colorDesc )
{
    return rgbTxt = [roundColor(colorDesc.getDouble(1382293536)),
					roundColor(colorDesc.getDouble(1198681632)),
					roundColor(colorDesc.getDouble(1114382368))];
}

//栅格化文本图层
function RasterizedTextLayer()
{
	var idrasterizeLayer = stringIDToTypeID( "rasterizeLayer" );
    var desc23 = new ActionDescriptor();
    var idnull = charIDToTypeID( "null" );
	var ref13 = new ActionReference();
	var idLyr = charIDToTypeID( "Lyr " );
	var idOrdn = charIDToTypeID( "Ordn" );
	var idTrgt = charIDToTypeID( "Trgt" );
	ref13.putEnumerated( idLyr, idOrdn, idTrgt );
    desc23.putReference( idnull, ref13 );
    var idWhat = charIDToTypeID( "What" );
    var idrasterizeItem = stringIDToTypeID( "rasterizeItem" );
    var idlayerStyle = stringIDToTypeID( "layerStyle" );
    desc23.putEnumerated( idWhat, idrasterizeItem, idlayerStyle );
	executeAction( idrasterizeLayer, desc23, DialogModes.NO );
}
///////////////////////////////////////////////////////////////////////////////////////////




